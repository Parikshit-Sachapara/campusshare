import uuid
from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, desc
from sqlalchemy.exc import IntegrityError, DBAPIError
from fastapi import status

from ..models import (
    Booking,
    Resource,
    ResourceUnit,
    Profile,
    WaitingList,
    AuditLog,
    PlatformSetting,
    UserRole,
)
from ..models.enums import (
    ResourceType,
    ResourceStatus,
    BookingStatus,
    WaitlistStatus,
)
from ..schemas.booking import (
    BookingCreate,
    BookingResponse,
    BookingDetailResponse,
    BookingValidateRequest,
    BookingValidateResponse,
    TimelineItem,
)
from ..schemas.waitlist import WaitlistResponse
from ..core.exceptions import CampusShareException
from ..core.audit import audit
from ..core.notify import notify
from .eligibility_service import EligibilityService
from .fairness_service import FairnessService
from .state_machine import BookingStateMachine

class BookingService:
    """
    Heart of CampusShare: High-Concurrency Booking Engine with
    Pessimistic Row-Level Locking, Automatic Unit Assignment,
    Exclusion-Constraint Violation Handling, and Idempotency Protection.
    """

    # In-memory idempotency cache for deduplicating concurrent double-submits
    _IDEMPOTENCY_CACHE: Dict[str, uuid.UUID] = {}

    @classmethod
    def validate_booking(
        cls,
        db: Session,
        user: Profile,
        data: BookingValidateRequest,
    ) -> BookingValidateResponse:
        """
        Dry-run validation endpoint for real-time frontend form feedback.
        """
        resource = db.query(Resource).filter_by(id=data.resource_id).first()
        if not resource:
            raise CampusShareException(
                code="RESOURCE_NOT_FOUND",
                message="Resource does not exist.",
                status_code=status.HTTP_404_NOT_FOUND,
            )

        eligibility = EligibilityService.evaluate(
            db=db,
            user=user,
            resource=resource,
            start_ts=data.start_ts,
            end_ts=data.end_ts,
            attendees=data.attendees,
        )

        priority_score, breakdown = FairnessService.calculate_priority(
            db=db,
            user=user,
            resource=resource,
            purpose=data.purpose,
            project_name=data.project_name,
            completed_eligibility_items=eligibility.completed_items_count,
            total_required_items=eligibility.total_required_items,
        )

        suggested_slots = []
        if not eligibility.eligible:
            duration_minutes = int((data.end_ts - data.start_ts).total_seconds() / 60)
            suggested_slots = EligibilityService.suggest_next_free_slots(
                db=db,
                resource=resource,
                start_ts=data.start_ts,
                duration_minutes=duration_minutes,
                count=3,
            )

        return BookingValidateResponse(
            eligible=eligibility.eligible,
            first_failing_reason=eligibility.first_failing_reason,
            checks=eligibility.checks,
            priority_preview=breakdown,
            suggested_slots=suggested_slots,
        )

    @classmethod
    def create_booking(
        cls,
        db: Session,
        user: Profile,
        data: BookingCreate,
        idempotency_key: Optional[str] = None,
        client_ip: Optional[str] = None,
    ) -> Booking:
        """
        Atomically requests or approves a booking inside ONE transaction.
        Uses SELECT ... FOR UPDATE / SKIP LOCKED to eliminate race conditions.
        """
        # 1. Idempotency Key check: if identical request is currently processing or processed
        if idempotency_key:
            existing_booking_id = cls._IDEMPOTENCY_CACHE.get(idempotency_key)
            if existing_booking_id:
                existing = db.query(Booking).filter_by(id=existing_booking_id).first()
                if existing:
                    return existing

        now = datetime.now(timezone.utc)
        start_ts = data.start_ts if data.start_ts.tzinfo else data.start_ts.replace(tzinfo=timezone.utc)
        end_ts = data.end_ts if data.end_ts.tzinfo else data.end_ts.replace(tzinfo=timezone.utc)
        duration_minutes = int((end_ts - start_ts).total_seconds() / 60)

        # 2. Concurrency Lock: Lock Resource Row for Facilities or Lock specific Unit for Equipment
        selected_unit_id: Optional[uuid.UUID] = None

        try:
            if data.resource_id:
                # Lock the parent resource record first
                resource = db.query(Resource).filter_by(id=data.resource_id).with_for_update().first()
                if not resource:
                    raise CampusShareException(
                        code="RESOURCE_NOT_FOUND",
                        message="The requested resource does not exist.",
                        status_code=status.HTTP_404_NOT_FOUND,
                    )

                if resource.resource_type == ResourceType.EQUIPMENT:
                    # Pick an available unit with SKIP LOCKED
                    active_units = db.query(ResourceUnit).filter(
                        ResourceUnit.resource_id == resource.id,
                        ResourceUnit.is_active == True,
                    ).order_by(ResourceUnit.unit_code).all()

                    for u in active_units:
                        # Check if u is locked or has conflicting approved bookings
                        conflict = db.query(Booking).filter(
                            Booking.unit_id == u.id,
                            Booking.status.in_([
                                BookingStatus.APPROVED,
                                BookingStatus.CHECKED_OUT,
                                BookingStatus.RETURN_PENDING,
                                BookingStatus.OVERDUE,
                                BookingStatus.INCIDENT_REPORTED,
                            ]),
                            Booking.start_ts < end_ts,
                            Booking.end_ts > start_ts,
                        ).first()

                        if not conflict:
                            # Attempt to lock this unit row
                            locked_u = db.query(ResourceUnit).filter_by(id=u.id).with_for_update(skip_locked=True).first()
                            if locked_u:
                                selected_unit_id = locked_u.id
                                break

                    if not selected_unit_id:
                        suggested = EligibilityService.suggest_next_free_slots(
                            db=db, resource=resource, start_ts=start_ts, duration_minutes=duration_minutes, count=3
                        )
                        raise CampusShareException(
                            code="SLOT_UNAVAILABLE",
                            message="All physical units are currently reserved for this time slot. Please choose another slot.",
                            status_code=status.HTTP_409_CONFLICT,
                            details={"suggested_slots": suggested}
                        )

            # 3. Re-run complete eligibility validation inside locked transaction
            eligibility = EligibilityService.evaluate(
                db=db,
                user=user,
                resource=resource,
                start_ts=start_ts,
                end_ts=end_ts,
                attendees=data.attendees,
            )

            if not eligibility.eligible:
                suggested = EligibilityService.suggest_next_free_slots(
                    db=db, resource=resource, start_ts=start_ts, duration_minutes=duration_minutes, count=3
                )
                raise CampusShareException(
                    code="ELIGIBILITY_FAILED",
                    message=eligibility.first_failing_reason or "Eligibility check failed.",
                    status_code=status.HTTP_409_CONFLICT,
                    details={
                        "checks": [c.model_dump() for c in eligibility.checks],
                        "suggested_slots": suggested,
                    }
                )

            # 4. Compute Priority Score and Breakdown
            priority_score, breakdown = FairnessService.calculate_priority(
                db=db,
                user=user,
                resource=resource,
                purpose=data.purpose,
                project_name=data.project_name,
                completed_eligibility_items=eligibility.completed_items_count,
                total_required_items=eligibility.total_required_items,
            )

            # 5. Determine Initial Status:
            # Student bookings are submitted for administrator & staff approval triage.
            # Owners/Admins/Managers booking directly may be auto-approved if no approval required.
            if user.role == UserRole.STUDENT:
                auto_approve = False
                initial_status = BookingStatus.PENDING
                approved_at = None
            else:
                auto_approve = (
                    not resource.approval_required
                    and not resource.is_restricted
                    and not eligibility.flagged_for_review
                )
                initial_status = BookingStatus.APPROVED if auto_approve else BookingStatus.PENDING
                approved_at = now if auto_approve else None

            # Generate unique human-readable booking code
            year_str = str(now.year)
            rand_code = uuid.uuid4().hex[:5].upper()
            booking_code = f"CS-{year_str}-{rand_code}"

            booking = Booking(
                booking_code=booking_code,
                student_id=user.id,
                resource_id=resource.id,
                unit_id=selected_unit_id,
                start_ts=start_ts,
                end_ts=end_ts,
                attendees=data.attendees,
                purpose=data.purpose.strip(),
                project_name=data.project_name.strip() if data.project_name else None,
                status=initial_status,
                approved_at=approved_at,
                priority_score=priority_score,
                priority_breakdown=breakdown,
                version=1,
            )

            db.add(booking)
            db.flush()

            # 6. Audit Logs
            audit(
                db=db,
                actor_id=user.id,
                actor_role=str(user.role.value if hasattr(user.role, "value") else user.role),
                action="BOOKING_REQUESTED",
                entity_type="Booking",
                entity_id=str(booking.id),
                resource_id=resource.id,
                booking_id=booking.id,
                metadata={
                    "booking_code": booking_code,
                    "status": initial_status.value,
                    "auto_approve": auto_approve,
                    "priority_score": priority_score,
                },
                ip=client_ip,
            )

            audit(
                db=db,
                actor_id=user.id,
                actor_role=str(user.role.value if hasattr(user.role, "value") else user.role),
                action="ELIGIBILITY_VERIFIED",
                entity_type="Booking",
                entity_id=str(booking.id),
                resource_id=resource.id,
                booking_id=booking.id,
                metadata={"checks_passed": eligibility.completed_items_count},
                ip=client_ip,
            )

            # 7. Notifications
            if auto_approve:
                notify(
                    db=db,
                    user_id=user.id,
                    type="BOOKING_APPROVED",
                    title="Booking Confirmed!",
                    body=f"Your booking for '{resource.name}' has been auto-approved. Pass code: {booking_code}.",
                    link=f"/bookings/{booking.id}",
                )
            else:
                notify(
                    db=db,
                    user_id=resource.owner_id,
                    type="APPROVAL_REQUIRED",
                    title="New Booking Request Pending",
                    body=f"{user.full_name} requested '{resource.name}' ({start_ts.strftime('%b %d, %H:%M')}). Priority: {priority_score:.1f}.",
                    link=f"/approvals/{booking.id}",
                )

            # Update resource popularity count
            resource.popularity_count = (resource.popularity_count or 0) + 1
            db.commit()
            db.refresh(booking)

            # Save to idempotency cache
            if idempotency_key:
                cls._IDEMPOTENCY_CACHE[idempotency_key] = booking.id

            return booking

        except IntegrityError as e:
            db.rollback()
            suggested = EligibilityService.suggest_next_free_slots(
                db=db, resource=resource, start_ts=start_ts, duration_minutes=duration_minutes, count=3
            )
            raise CampusShareException(
                code="CONCURRENT_BOOKING_CONFLICT",
                message="Slot was just secured by another concurrent user. Please choose an alternative slot below.",
                status_code=status.HTTP_409_CONFLICT,
                details={"suggested_slots": suggested}
            )

    @classmethod
    def cancel_booking(
        cls,
        db: Session,
        booking_id: uuid.UUID,
        user: Profile,
        reason: Optional[str] = None,
        client_ip: Optional[str] = None,
    ) -> Booking:
        """
        Cancels a booking, marks status CANCELLED via state machine,
        audits, notifies, and automatically triggers waitlist slot redistribution.
        """
        booking = db.query(Booking).filter_by(id=booking_id).with_for_update().first()
        if not booking:
            raise CampusShareException(
                code="BOOKING_NOT_FOUND",
                message="Booking not found.",
                status_code=status.HTTP_404_NOT_FOUND,
            )

        # Authorization: Student who owns the booking, resource owner, or admin/manager
        is_owner = booking.student_id == user.id
        is_staff = user.role in [UserRole.OWNER, UserRole.MANAGER, UserRole.ADMIN]
        if not is_owner and not is_staff:
            raise CampusShareException(
                code="FORBIDDEN_CANCEL",
                message="You do not have permission to cancel this booking.",
                status_code=status.HTTP_403_FORBIDDEN,
            )

        # State Machine Transition
        BookingStateMachine.transition(booking, BookingStatus.CANCELLED)
        booking.cancellation_reason = reason or "Cancelled by user"

        # Record Audit
        audit(
            db=db,
            actor_id=user.id,
            actor_role=str(user.role.value if hasattr(user.role, "value") else user.role),
            action="BOOKING_CANCELLED",
            entity_type="Booking",
            entity_id=str(booking.id),
            resource_id=booking.resource_id,
            booking_id=booking.id,
            metadata={"reason": booking.cancellation_reason},
            ip=client_ip,
        )

        # Notify student and resource owner
        notify(
            db=db,
            user_id=booking.student_id,
            type="BOOKING_CANCELLED",
            title="Booking Cancelled",
            body=f"Booking {booking.booking_code} has been cancelled.",
            link=f"/bookings/{booking.id}",
        )

        # Trigger Cancellation Waitlist Redistribution for freed window
        cls.redistribute_freed_slot(
            db=db,
            resource_id=booking.resource_id,
            freed_start_ts=booking.start_ts,
            freed_end_ts=booking.end_ts,
        )

        db.commit()
        db.refresh(booking)
        return booking

    @classmethod
    def get_student_bookings(
        cls,
        db: Session,
        student_id: uuid.UUID,
        status_filter: Optional[BookingStatus] = None,
        page: int = 1,
        page_size: int = 10,
    ) -> Tuple[List[Booking], int]:
        query = db.query(Booking).filter(Booking.student_id == student_id)
        if status_filter:
            query = query.filter(Booking.status == status_filter)

        total = query.count()
        offset = (page - 1) * page_size
        items = query.order_by(desc(Booking.created_at)).offset(offset).limit(page_size).all()
        return items, total

    @classmethod
    def get_booking_details_with_timeline(
        cls,
        db: Session,
        booking_id: uuid.UUID,
        user: Profile,
    ) -> BookingDetailResponse:
        booking = db.query(Booking).filter_by(id=booking_id).first()
        if not booking:
            raise CampusShareException(
                code="BOOKING_NOT_FOUND",
                message="Booking not found.",
                status_code=status.HTTP_404_NOT_FOUND,
            )

        # Authorization: Student or Resource Owner or Manager or Admin
        is_student = (booking.student_id == user.id)
        is_owner = (booking.resource.owner_id == user.id) if booking.resource else False
        is_privileged = user.role in [UserRole.MANAGER, UserRole.ADMIN]
        if not is_student and not is_owner and not is_privileged:
            raise CampusShareException(
                code="FORBIDDEN_ACCESS",
                message="You do not have permission to view this booking.",
                status_code=status.HTTP_403_FORBIDDEN,
            )

        # Fetch audit timeline
        logs = db.query(AuditLog).filter(
            or_(
                AuditLog.booking_id == booking.id,
                and_(AuditLog.entity_type == "Booking", AuditLog.entity_id == str(booking.id))
            )
        ).order_by(AuditLog.created_at.asc()).all()

        timeline: List[TimelineItem] = []
        for l in logs:
            actor = db.query(Profile).filter_by(id=l.actor_id).first() if l.actor_id else None
            timeline.append(TimelineItem(
                id=l.id,
                action=l.action,
                actor_name=actor.full_name if actor else (l.actor_role or "System"),
                actor_role=l.actor_role,
                created_at=l.created_at,
                metadata=l.audit_metadata,
            ))

        # Re-evaluate live eligibility checks
        eligibility = EligibilityService.evaluate(
            db=db,
            user=booking.student,
            resource=booking.resource,
            start_ts=booking.start_ts,
            end_ts=booking.end_ts,
            attendees=booking.attendees,
        )

        resp = BookingResponse(
            id=booking.id,
            booking_code=booking.booking_code,
            resource_id=booking.resource_id,
            resource_name=booking.resource.name if booking.resource else None,
            resource_type=booking.resource.resource_type if booking.resource else None,
            student_id=booking.student_id,
            student_name=booking.student.full_name if booking.student else None,
            student_email=booking.student.email if booking.student else None,
            unit_id=booking.unit_id,
            unit_code=booking.unit.unit_code if booking.unit else None,
            start_ts=booking.start_ts,
            end_ts=booking.end_ts,
            attendees=booking.attendees,
            purpose=booking.purpose,
            project_name=booking.project_name,
            status=booking.status,
            approver_id=booking.approver_id,
            approver_name=booking.approver.full_name if booking.approver else None,
            approved_at=booking.approved_at,
            rejection_reason=booking.rejection_reason,
            alternative_start_ts=booking.alternative_start_ts,
            alternative_end_ts=booking.alternative_end_ts,
            collected_at=booking.collected_at,
            returned_at=booking.returned_at,
            cancellation_reason=booking.cancellation_reason,
            priority_score=float(booking.priority_score) if booking.priority_score is not None else None,
            priority_breakdown=booking.priority_breakdown,
            override_by=booking.override_by,
            override_reason=booking.override_reason,
            version=booking.version,
            created_at=booking.created_at,
            updated_at=booking.updated_at,
        )

        return BookingDetailResponse(
            **resp.model_dump(),
            timeline=timeline,
            eligibility_checks=eligibility.checks,
        )

    @classmethod
    def override_priority(
        cls,
        db: Session,
        booking_id: uuid.UUID,
        user: Profile,
        new_score: float,
        reason: str,
        client_ip: Optional[str] = None,
    ) -> Booking:
        """
        Manager or Admin priority score override with mandatory audit reasoning.
        """
        if user.role not in [UserRole.MANAGER, UserRole.ADMIN]:
            raise CampusShareException(
                code="FORBIDDEN_OVERRIDE",
                message="Only Faculty Managers or Administrators may override booking priority scores.",
                status_code=status.HTTP_403_FORBIDDEN,
            )

        booking = db.query(Booking).filter_by(id=booking_id).with_for_update().first()
        if not booking:
            raise CampusShareException(
                code="BOOKING_NOT_FOUND",
                message="Booking not found.",
                status_code=status.HTTP_404_NOT_FOUND,
            )

        old_score = float(booking.priority_score or 0.0)
        booking.priority_score = new_score
        booking.override_by = user.id
        booking.override_reason = reason.strip()

        audit(
            db=db,
            actor_id=user.id,
            actor_role=str(user.role.value if hasattr(user.role, "value") else user.role),
            action="PRIORITY_OVERRIDDEN",
            entity_type="Booking",
            entity_id=str(booking.id),
            resource_id=booking.resource_id,
            booking_id=booking.id,
            metadata={
                "old_score": old_score,
                "new_score": new_score,
                "reason": reason.strip(),
            },
            ip=client_ip,
        )

        db.commit()
        db.refresh(booking)
        return booking

    # -------------------------------------------------------------
    # WAITING LIST & REDISTRIBUTION
    # -------------------------------------------------------------
    @classmethod
    def join_waitlist(
        cls,
        db: Session,
        user: Profile,
        resource_id: uuid.UUID,
        desired_start_ts: datetime,
        desired_end_ts: datetime,
    ) -> WaitingList:
        resource = db.query(Resource).filter_by(id=resource_id).first()
        if not resource:
            raise CampusShareException(
                code="RESOURCE_NOT_FOUND",
                message="Resource does not exist.",
                status_code=status.HTTP_404_NOT_FOUND,
            )

        # Compute priority for queue order
        priority_score, breakdown = FairnessService.calculate_priority(
            db=db,
            user=user,
            resource=resource,
            purpose="Waitlist request",
            hours_waiting=0.0,
        )

        entry = WaitingList(
            resource_id=resource_id,
            student_id=user.id,
            desired_start_ts=desired_start_ts,
            desired_end_ts=desired_end_ts,
            priority_score=priority_score,
            priority_breakdown=breakdown,
            status=WaitlistStatus.WAITING,
        )
        db.add(entry)
        db.flush()

        audit(
            db=db,
            actor_id=user.id,
            actor_role=str(user.role.value if hasattr(user.role, "value") else user.role),
            action="WAITLIST_JOINED",
            entity_type="WaitingList",
            entity_id=str(entry.id),
            resource_id=resource_id,
            metadata={"priority_score": priority_score},
        )
        db.commit()
        db.refresh(entry)
        return entry

    @classmethod
    def leave_waitlist(cls, db: Session, waitlist_id: uuid.UUID, user: Profile) -> None:
        entry = db.query(WaitingList).filter_by(id=waitlist_id).first()
        if not entry:
            raise CampusShareException(code="WAITLIST_NOT_FOUND", message="Waitlist entry not found.", status_code=404)
        if entry.student_id != user.id and user.role != UserRole.ADMIN:
            raise CampusShareException(code="FORBIDDEN_ACTION", message="Unauthorized.", status_code=403)

        entry.status = WaitlistStatus.CANCELLED
        db.commit()

    @classmethod
    def get_my_waitlist(cls, db: Session, user: Profile) -> List[WaitlistResponse]:
        entries = db.query(WaitingList).filter(
            WaitingList.student_id == user.id,
            WaitingList.status.in_([WaitlistStatus.WAITING, WaitlistStatus.OFFERED])
        ).order_by(desc(WaitingList.created_at)).all()

        results: List[WaitlistResponse] = []
        for e in entries:
            # Calculate live queue position
            position = db.query(WaitingList).filter(
                WaitingList.resource_id == e.resource_id,
                WaitingList.status == WaitlistStatus.WAITING,
                or_(
                    WaitingList.priority_score > e.priority_score,
                    and_(WaitingList.priority_score == e.priority_score, WaitingList.created_at < e.created_at)
                )
            ).count() + 1

            results.append(WaitlistResponse(
                id=e.id,
                resource_id=e.resource_id,
                resource_name=e.resource.name if e.resource else None,
                student_id=e.student_id,
                student_name=e.student.full_name if e.student else None,
                desired_start_ts=e.desired_start_ts,
                desired_end_ts=e.desired_end_ts,
                priority_score=float(e.priority_score),
                priority_breakdown=e.priority_breakdown,
                status=e.status,
                position=position if e.status == WaitlistStatus.WAITING else None,
                offered_at=e.offered_at,
                offer_expires_at=e.offer_expires_at,
                created_at=e.created_at,
                updated_at=e.updated_at,
            ))

        return results

    @classmethod
    def redistribute_freed_slot(
        cls,
        db: Session,
        resource_id: uuid.UUID,
        freed_start_ts: datetime,
        freed_end_ts: datetime,
    ) -> Optional[WaitingList]:
        """
        When a slot is freed by cancellation, finds the highest-priority eligible
        WAITING entry matching the freed window, sets status OFFERED with offer_expires_at,
        and notifies the student.
        """
        now = datetime.now(timezone.utc)

        # Read expiry hours setting (default 12 hours)
        setting = db.query(PlatformSetting).filter_by(key="waitlist_offer_expiry_hours").first()
        expiry_hours = 12
        if setting and isinstance(setting.value, (int, float)):
            expiry_hours = int(setting.value)

        offer_expiry = now + timedelta(hours=expiry_hours)

        # Candidates ordered by priority_score DESC, created_at ASC
        candidates = db.query(WaitingList).filter(
            WaitingList.resource_id == resource_id,
            WaitingList.status == WaitlistStatus.WAITING,
            WaitingList.desired_start_ts >= freed_start_ts,
            WaitingList.desired_end_ts <= freed_end_ts,
        ).order_by(desc(WaitingList.priority_score), WaitingList.created_at.asc()).all()

        for c in candidates:
            # Check eligibility of candidate
            resource = db.query(Resource).filter_by(id=resource_id).first()
            student = db.query(Profile).filter_by(id=c.student_id).first()
            if not resource or not student:
                continue

            elig = EligibilityService.evaluate(
                db=db,
                user=student,
                resource=resource,
                start_ts=c.desired_start_ts,
                end_ts=c.desired_end_ts,
            )
            if elig.eligible:
                c.status = WaitlistStatus.OFFERED
                c.offered_at = now
                c.offer_expires_at = offer_expiry

                # Notify
                notify(
                    db=db,
                    user_id=student.id,
                    type="WAITLIST_OFFER",
                    title="Exclusive Slot Offer!",
                    body=f"A slot opened up for '{resource.name}'. Claim within {expiry_hours} hours!",
                    link=f"/waitlist/{c.id}",
                )

                audit(
                    db=db,
                    actor_id=None,
                    actor_role="SYSTEM",
                    action="WAITLIST_SLOT_OFFERED",
                    entity_type="WaitingList",
                    entity_id=str(c.id),
                    resource_id=resource_id,
                    metadata={"student_id": str(student.id), "offer_expires_at": offer_expiry.isoformat()},
                )
                db.flush()
                return c

        return None

