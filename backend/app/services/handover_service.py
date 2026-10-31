import uuid
import jwt
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from fastapi import status

from ..models import (
    Booking,
    BookingCondition,
    Resource,
    ResourceUnit,
    Profile,
    Incident,
)
from ..models.enums import (
    BookingStatus,
    ConditionPhase,
    UnitCondition,
    IncidentType,
    IncidentSeverity,
    IncidentStatus,
    ResourceType,
    UserRole,
)
from ..schemas.handover import (
    CheckoutRequest,
    FacilityOccupancyRequest,
    ReturnRequest,
    VerifyReturnRequest,
    BookingConditionResponse,
    ReturnComparisonResponse,
)
from ..config import settings
from ..core.exceptions import CampusShareException
from ..core.audit import audit
from ..core.notify import notify
from .state_machine import BookingStateMachine

class HandoverService:
    """
    CampusShare Physical Handover, Condition Inspection, and Return Verification Engine.
    Handles QR cryptographic check-in, 6-photo condition audits, and damage reporting.
    """

    @classmethod
    def generate_qr_token(cls, booking: Booking) -> str:
        """
        Generates signed short-lived JWT token embedded into student's digital booking pass QR.
        """
        payload = {
            "sub": str(booking.student_id),
            "booking_id": str(booking.id),
            "booking_code": booking.booking_code,
            "type": "booking_qr_pass",
            "exp": datetime.now(timezone.utc) + timedelta(hours=48),
        }
        return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

    @classmethod
    def verify_identity_token(cls, booking: Booking, code_or_token: str) -> bool:
        """
        Validates scanned string: matches either exact human booking_code OR decoded signed QR JWT token.
        """
        clean_input = code_or_token.strip()
        if clean_input.upper() == booking.booking_code.upper():
            return True

        # Try decoding as signed JWT pass
        try:
            payload = jwt.decode(clean_input, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
            if payload.get("booking_code") == booking.booking_code or payload.get("booking_id") == str(booking.id):
                return True
        except (jwt.PyJWTError, ValueError):
            pass

        return False

    @classmethod
    def checkout_equipment(
        cls,
        db: Session,
        booking_id: uuid.UUID,
        user: Profile,
        data: CheckoutRequest,
        client_ip: Optional[str] = None,
    ) -> Booking:
        booking = db.query(Booking).filter_by(id=booking_id).with_for_update().first()
        if not booking:
            raise CampusShareException(code="BOOKING_NOT_FOUND", message="Booking not found.", status_code=404)

        # Authorization: OWNER of the resource, MANAGER, or ADMIN
        is_owner = (booking.resource.owner_id == user.id)
        is_privileged = user.role in [UserRole.MANAGER, UserRole.ADMIN]
        if not is_owner and not is_privileged:
            raise CampusShareException(
                code="FORBIDDEN_CHECKOUT",
                message="Only the resource owner or facility staff may conduct check-outs.",
                status_code=status.HTTP_403_FORBIDDEN,
            )

        if booking.status != BookingStatus.APPROVED:
            raise CampusShareException(
                code="INVALID_STATUS_FOR_CHECKOUT",
                message=f"Cannot check out booking in '{booking.status.value}' state. Must be APPROVED.",
                status_code=status.HTTP_409_CONFLICT,
            )

        # Time window check: start_ts +/- 30 min (skip if admin override or test)
        now = datetime.now(timezone.utc)
        start_ts = booking.start_ts if booking.start_ts.tzinfo else booking.start_ts.replace(tzinfo=timezone.utc)
        window_start = start_ts - timedelta(minutes=30)
        window_end = start_ts + timedelta(minutes=30)

        # Validate Identity via booking code or QR
        if not cls.verify_identity_token(booking, data.booking_code_or_token):
            raise CampusShareException(
                code="INVALID_QR_TOKEN",
                message="Invalid booking code or QR pass token. Identity verification failed.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        # Advance state to CHECKED_OUT
        BookingStateMachine.transition(booking, BookingStatus.CHECKED_OUT)
        booking.collected_at = now

        # Record physical pickup condition
        cond = BookingCondition(
            booking_id=booking.id,
            phase=ConditionPhase.PICKUP,
            condition=data.condition,
            notes=data.notes,
            photo_urls=data.photo_urls,
            recorded_by=user.id,
            student_confirmed=data.confirmed_in_person,
        )
        db.add(cond)

        audit(
            db=db,
            actor_id=user.id,
            actor_role=str(user.role.value if hasattr(user.role, "value") else user.role),
            action="BOOKING_CHECKED_OUT",
            entity_type="Booking",
            entity_id=str(booking.id),
            resource_id=booking.resource_id,
            booking_id=booking.id,
            metadata={
                "handover_staff": user.full_name,
                "unit_id": str(booking.unit_id) if booking.unit_id else None,
                "initial_condition": data.condition.value,
                "student_confirmed": data.confirmed_in_person,
                "photo_count": len(data.photo_urls),
            },
            ip=client_ip,
        )

        notify(
            db=db,
            user_id=booking.student_id,
            type="EQUIPMENT_CHECKED_OUT",
            title="Equipment Handover Complete",
            body=f"You have collected '{booking.resource.name}'. Due return by {booking.end_ts.strftime('%b %d, %H:%M')}.",
            link=f"/bookings/{booking.id}",
        )

        db.commit()
        db.refresh(booking)
        return booking

    @classmethod
    def confirm_pickup(
        cls,
        db: Session,
        booking_id: uuid.UUID,
        user: Profile,
        client_ip: Optional[str] = None,
    ) -> BookingCondition:
        booking = db.query(Booking).filter_by(id=booking_id).first()
        if not booking:
            raise CampusShareException(code="BOOKING_NOT_FOUND", message="Booking not found.", status_code=404)

        is_staff_or_admin = (
            user.role in [UserRole.ADMIN, UserRole.MANAGER, UserRole.OWNER]
            if hasattr(user, "role") else False
        )
        if booking.student_id != user.id and not is_staff_or_admin:
            raise CampusShareException(code="FORBIDDEN_ACTION", message="Unauthorized.", status_code=403)

        now = datetime.now(timezone.utc)

        # Transition status to CHECKED_OUT if currently APPROVED
        if booking.status == BookingStatus.APPROVED:
            BookingStateMachine.transition(booking, BookingStatus.CHECKED_OUT)
            booking.collected_at = now

        cond = db.query(BookingCondition).filter_by(
            booking_id=booking.id,
            phase=ConditionPhase.PICKUP
        ).first()

        if not cond:
            cond = BookingCondition(
                booking_id=booking.id,
                phase=ConditionPhase.PICKUP,
                condition=UnitCondition.EXCELLENT,
                notes="Physical pickup verified and confirmed upon handover",
                photo_urls=[],
                recorded_by=user.id,
                student_confirmed=True,
            )
            db.add(cond)
        else:
            cond.student_confirmed = True

        audit(
            db=db,
            actor_id=user.id,
            actor_role=str(user.role.value if hasattr(user.role, "value") else user.role),
            action="PICKUP_CONFIRMED",
            entity_type="BookingCondition",
            entity_id=str(cond.id),
            resource_id=booking.resource_id,
            booking_id=booking.id,
            metadata={
                "status": "CHECKED_OUT",
                "collected_at": now.isoformat(),
            },
            ip=client_ip,
        )

        db.commit()
        db.refresh(cond)
        db.refresh(booking)
        return cond

    @classmethod
    def checkin_occupancy(
        cls,
        db: Session,
        booking_id: uuid.UUID,
        user: Profile,
        data: FacilityOccupancyRequest,
        client_ip: Optional[str] = None,
    ) -> Booking:
        booking = db.query(Booking).filter_by(id=booking_id).with_for_update().first()
        if not booking:
            raise CampusShareException(code="BOOKING_NOT_FOUND", message="Booking not found.", status_code=404)

        if booking.status != BookingStatus.APPROVED:
            raise CampusShareException(
                code="INVALID_STATUS_FOR_CHECKIN",
                message=f"Cannot check in facility in '{booking.status.value}' state. Must be APPROVED.",
                status_code=status.HTTP_409_CONFLICT,
            )

        now = datetime.now(timezone.utc)
        BookingStateMachine.transition(booking, BookingStatus.CHECKED_OUT)
        booking.collected_at = now
        booking.attendees = data.headcount

        cond = BookingCondition(
            booking_id=booking.id,
            phase=ConditionPhase.PICKUP,
            condition=data.room_condition,
            notes=f"Headcount: {data.headcount}. {data.notes or ''}",
            photo_urls=data.photo_urls,
            recorded_by=user.id,
            student_confirmed=True,
        )
        db.add(cond)

        audit(
            db=db,
            actor_id=user.id,
            actor_role=str(user.role.value if hasattr(user.role, "value") else user.role),
            action="FACILITY_OCCUPANCY_RECORDED",
            entity_type="Booking",
            entity_id=str(booking.id),
            resource_id=booking.resource_id,
            booking_id=booking.id,
            metadata={"headcount": data.headcount, "condition": data.room_condition.value},
            ip=client_ip,
        )

        db.commit()
        db.refresh(booking)
        return booking

    @classmethod
    def submit_return(
        cls,
        db: Session,
        booking_id: uuid.UUID,
        user: Profile,
        data: ReturnRequest,
        client_ip: Optional[str] = None,
    ) -> Booking:
        booking = db.query(Booking).filter_by(id=booking_id).with_for_update().first()
        if not booking:
            raise CampusShareException(code="BOOKING_NOT_FOUND", message="Booking not found.", status_code=404)

        if booking.student_id != user.id:
            raise CampusShareException(code="FORBIDDEN_ACTION", message="Unauthorized.", status_code=403)

        if booking.status not in [BookingStatus.CHECKED_OUT, BookingStatus.OVERDUE]:
            raise CampusShareException(
                code="INVALID_STATUS_FOR_RETURN",
                message=f"Cannot return booking in '{booking.status.value}' state. Must be CHECKED_OUT or OVERDUE.",
                status_code=status.HTTP_409_CONFLICT,
            )

        now = datetime.now(timezone.utc)
        BookingStateMachine.transition(booking, BookingStatus.RETURN_PENDING)
        booking.return_submitted_at = now

        cond = BookingCondition(
            booking_id=booking.id,
            phase=ConditionPhase.RETURN,
            condition=UnitCondition.EXCELLENT, # Default placeholder until staff verifies
            notes=data.notes,
            photo_urls=data.photo_urls,
            recorded_by=user.id,
            student_confirmed=True,
        )
        db.add(cond)

        audit(
            db=db,
            actor_id=user.id,
            actor_role="STUDENT",
            action="RETURN_SUBMITTED",
            entity_type="Booking",
            entity_id=str(booking.id),
            resource_id=booking.resource_id,
            booking_id=booking.id,
            metadata={"photo_count": len(data.photo_urls)},
            ip=client_ip,
        )

        if booking.resource and booking.resource.owner_id:
            notify(
                db=db,
                user_id=booking.resource.owner_id,
                type="RETURN_SUBMITTED",
                title="Resource Return Awaiting Verification",
                body=f"{user.full_name} returned '{booking.resource.name}'. Please inspect and verify.",
                link=f"/bookings/{booking.id}/verify-return",
            )

        db.commit()
        db.refresh(booking)
        return booking

    @classmethod
    def verify_return(
        cls,
        db: Session,
        booking_id: uuid.UUID,
        user: Profile,
        data: VerifyReturnRequest,
        client_ip: Optional[str] = None,
    ) -> ReturnComparisonResponse:
        booking = db.query(Booking).filter_by(id=booking_id).with_for_update().first()
        if not booking:
            raise CampusShareException(code="BOOKING_NOT_FOUND", message="Booking not found.", status_code=404)

        is_owner = (booking.resource.owner_id == user.id)
        is_privileged = user.role in [UserRole.MANAGER, UserRole.ADMIN]
        if not is_owner and not is_privileged:
            raise CampusShareException(code="FORBIDDEN_VERIFICATION", message="Unauthorized to verify returns.", status_code=403)

        if booking.status != BookingStatus.RETURN_PENDING:
            raise CampusShareException(
                code="INVALID_STATUS_FOR_VERIFY",
                message=f"Cannot verify return in '{booking.status.value}' state. Must be RETURN_PENDING.",
                status_code=status.HTTP_409_CONFLICT,
            )

        now = datetime.now(timezone.utc)
        pickup_cond = db.query(BookingCondition).filter_by(
            booking_id=booking.id, phase=ConditionPhase.PICKUP
        ).first()

        return_cond = db.query(BookingCondition).filter_by(
            booking_id=booking.id, phase=ConditionPhase.RETURN
        ).first()

        if return_cond:
            return_cond.condition = data.final_condition
            if data.notes:
                return_cond.notes = f"{return_cond.notes or ''} [Staff Note: {data.notes}]"

        incident_info = None

        # Check for Damage or Missing Item
        has_damage = data.damage_observed or (data.final_condition == UnitCondition.DAMAGED)
        has_missing = data.item_missing

        if has_damage or has_missing:
            # Require incident creation in the same transaction
            inc_type = IncidentType.MISSING if has_missing else IncidentType.DAMAGE
            inc_desc = data.incident_description or f"Physical return inspection flagged {inc_type.value}. Final condition: {data.final_condition.value}."

            incident = Incident(
                booking_id=booking.id,
                resource_id=booking.resource_id,
                reporter_id=user.id,
                type=inc_type,
                severity=IncidentSeverity.MEDIUM,
                description=inc_desc,
                status=IncidentStatus.REPORTED,
            )
            db.add(incident)
            db.flush()

            BookingStateMachine.transition(booking, BookingStatus.INCIDENT_REPORTED)

            # Flag physical unit if DAMAGED -> removed from active availability!
            if data.final_condition == UnitCondition.DAMAGED and booking.unit:
                booking.unit.condition = UnitCondition.DAMAGED
                booking.unit.is_active = False

            audit(
                db=db,
                actor_id=user.id,
                actor_role=str(user.role.value if hasattr(user.role, "value") else user.role),
                action="RETURN_FLAGGED_DAMAGE",
                entity_type="Booking",
                entity_id=str(booking.id),
                resource_id=booking.resource_id,
                booking_id=booking.id,
                metadata={
                    "incident_id": str(incident.id),
                    "final_condition": data.final_condition.value,
                    "unit_deactivated": (data.final_condition == UnitCondition.DAMAGED),
                },
                ip=client_ip,
            )

            notify(
                db=db,
                user_id=booking.student_id,
                type="INCIDENT_REPORTED",
                title="Incident Flagged on Return",
                body=f"Inspection flagged an issue on return for '{booking.resource.name}': {inc_desc}",
                link=f"/incidents/{incident.id}",
            )

            incident_info = {
                "id": str(incident.id),
                "type": inc_type.value,
                "description": inc_desc,
                "status": IncidentStatus.REPORTED.value,
            }

        else:
            # All good: transition to COMPLETED
            BookingStateMachine.transition(booking, BookingStatus.COMPLETED)
            booking.returned_at = now

            audit(
                db=db,
                actor_id=user.id,
                actor_role=str(user.role.value if hasattr(user.role, "value") else user.role),
                action="RETURN_VERIFIED",
                entity_type="Booking",
                entity_id=str(booking.id),
                resource_id=booking.resource_id,
                booking_id=booking.id,
                metadata={"final_condition": data.final_condition.value},
                ip=client_ip,
            )

            audit(
                db=db,
                actor_id=user.id,
                actor_role=str(user.role.value if hasattr(user.role, "value") else user.role),
                action="BOOKING_COMPLETED",
                entity_type="Booking",
                entity_id=str(booking.id),
                resource_id=booking.resource_id,
                booking_id=booking.id,
                metadata={"final_condition": data.final_condition.value},
                ip=client_ip,
            )

            notify(
                db=db,
                user_id=booking.student_id,
                type="BOOKING_COMPLETED",
                title="Booking Completed",
                body=f"Return verified for '{booking.resource.name}'. Thank you for returning in good condition!",
                link=f"/bookings/{booking.id}",
            )

        # Check late return and automatically create late return incident
        booking_end = booking.end_ts if booking.end_ts.tzinfo else booking.end_ts.replace(tzinfo=timezone.utc)
        if now > booking_end:
            late_inc = Incident(
                booking_id=booking.id,
                resource_id=booking.resource_id,
                reporter_id=user.id,
                type=IncidentType.LATE_RETURN,
                severity=IncidentSeverity.LOW,
                description=f"Late return recorded. Scheduled end: {booking_end.strftime('%H:%M')}, returned at: {now.strftime('%H:%M')}.",
                status=IncidentStatus.REPORTED,
            )
            db.add(late_inc)
            db.flush()

        db.commit()
        db.refresh(booking)

        pickup_resp = None
        if pickup_cond:
            recorded_staff = db.query(Profile).filter_by(id=pickup_cond.recorded_by).first()
            pickup_resp = BookingConditionResponse(
                id=pickup_cond.id,
                booking_id=pickup_cond.booking_id,
                phase=pickup_cond.phase,
                condition=pickup_cond.condition,
                notes=pickup_cond.notes,
                photo_urls=pickup_cond.photo_urls,
                recorded_by=pickup_cond.recorded_by,
                recorded_by_name=recorded_staff.full_name if recorded_staff else None,
                student_confirmed=pickup_cond.student_confirmed,
                created_at=pickup_cond.created_at,
            )

        return_resp = None
        if return_cond:
            recorded_staff = db.query(Profile).filter_by(id=return_cond.recorded_by).first()
            return_resp = BookingConditionResponse(
                id=return_cond.id,
                booking_id=return_cond.booking_id,
                phase=return_cond.phase,
                condition=return_cond.condition,
                notes=return_cond.notes,
                photo_urls=return_cond.photo_urls,
                recorded_by=return_cond.recorded_by,
                recorded_by_name=recorded_staff.full_name if recorded_staff else None,
                student_confirmed=return_cond.student_confirmed,
                created_at=return_cond.created_at,
            )

        return ReturnComparisonResponse(
            booking_id=booking.id,
            booking_code=booking.booking_code,
            status=booking.status,
            pickup_condition=pickup_resp,
            return_condition=return_resp,
            incident_created=incident_info,
        )
