import uuid
from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime, date, time, timedelta, timezone
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, and_, func, text, desc, asc
from fastapi import status

from ..models import (
    Resource,
    ResourceCategory,
    Department,
    ResourceUnit,
    ResourceImage,
    ResourceRule,
    ResourceAvailability,
    ResourceBlackout,
    Training,
    TrainingRecord,
    Booking,
    Profile,
    ResourceType,
    ResourceStatus,
    BookingStatus,
    UserRole,
    UsageLimit,
    LimitScope,
)
from ..schemas.resource import (
    ResourceCreate,
    ResourceUpdate,
    EligibilityCheckItem,
    EligibilityResponse,
    DayAvailability,
    FreeSlotItem,
)
from ..core.audit import audit
from ..core.exceptions import CampusShareException
from ..core.deps import check_resource_management_rights

class ResourceService:
    @staticmethod
    def get_resource_or_404(db: Session, resource_id: uuid.UUID) -> Resource:
        res = db.query(Resource).filter_by(id=resource_id).first()
        if not res:
            raise CampusShareException(
                code="RESOURCE_NOT_FOUND",
                message="Resource not found.",
                status_code=status.HTTP_404_NOT_FOUND,
            )
        return res

    @staticmethod
    def create_resource(db: Session, data: ResourceCreate, owner: Profile, client_ip: Optional[str] = None) -> Resource:
        from .auth_service import AuthService
        resolved_dept_id = AuthService.resolve_department_id(db, data.department_id)

        # Resolve category
        cat_id = None
        if data.category_id:
            try:
                cat_id = uuid.UUID(str(data.category_id))
            except ValueError:
                cat = db.query(ResourceCategory).filter(ResourceCategory.name.ilike(str(data.category_id))).first()
                cat_id = cat.id if cat else db.query(ResourceCategory).first().id

        res = Resource(
            name=data.name.strip(),
            description=data.description,
            category_id=cat_id,
            department_id=resolved_dept_id,
            owner_id=owner.id,
            location=data.location.strip(),
            resource_type=data.resource_type or ResourceType.EQUIPMENT,
            quantity=data.quantity,
            capacity=data.capacity,
            status=ResourceStatus.AVAILABLE,
            deposit_amount=data.deposit_amount,
            approval_required=data.approval_required,
            training_required=data.training_required,
            is_restricted=data.is_restricted,
            min_booking_minutes=data.min_booking_minutes,
            max_booking_minutes=data.max_booking_minutes,
            slot_minutes=data.slot_minutes,
            advance_booking_days=data.advance_booking_days,
            specifications=data.specifications or {},
        )
        db.add(res)
        db.flush()

        # Create physical units: equipment has N units, facilities have 1 unit
        num_units = 1 if res.resource_type == ResourceType.FACILITY else res.quantity
        prefix = "".join([w[0].upper() for w in res.name.split()[:3]]) or "UNIT"
        for i in range(1, num_units + 1):
            unit = ResourceUnit(
                resource_id=res.id,
                unit_code=f"{prefix}-{i:03d}",
                is_active=True,
            )
            db.add(unit)

        # Default availability: Mon-Fri 08:00 - 18:00
        for day in range(5):
            av = ResourceAvailability(
                resource_id=res.id,
                day_of_week=day,
                open_time=time(8, 0),
                close_time=time(18, 0),
            )
            db.add(av)

        audit(
            db=db,
            actor_id=owner.id,
            actor_role=str(owner.role),
            action="RESOURCE_CREATED",
            entity_type="Resource",
            entity_id=str(res.id),
            resource_id=res.id,
            metadata={"name": res.name, "quantity": res.quantity},
            ip=client_ip,
        )

        db.commit()
        db.refresh(res)
        return res

    @staticmethod
    def update_resource(db: Session, resource_id: uuid.UUID, data: ResourceUpdate, user: Profile, client_ip: Optional[str] = None) -> Resource:
        res = ResourceService.get_resource_or_404(db, resource_id)
        check_resource_management_rights(res, user)

        update_dict = data.model_dump(exclude_unset=True)
        for k, v in update_dict.items():
            setattr(res, k, v)

        audit(
            db=db,
            actor_id=user.id,
            actor_role=str(user.role),
            action="RESOURCE_UPDATED",
            entity_type="Resource",
            entity_id=str(res.id),
            resource_id=res.id,
            metadata=update_dict,
            ip=client_ip,
        )

        db.commit()
        db.refresh(res)
        return res

    @staticmethod
    def archive_or_delete_resource(db: Session, resource_id: uuid.UUID, user: Profile, client_ip: Optional[str] = None) -> Dict[str, str]:
        res = ResourceService.get_resource_or_404(db, resource_id)
        check_resource_management_rights(res, user)

        # Rule: soft archive, no hard delete when bookings exist
        bookings_count = db.query(Booking).filter_by(resource_id=resource_id).count()
        if bookings_count > 0:
            res.status = ResourceStatus.ARCHIVED
            audit(
                db=db,
                actor_id=user.id,
                actor_role=str(user.role),
                action="RESOURCE_ARCHIVED",
                entity_type="Resource",
                entity_id=str(res.id),
                resource_id=res.id,
                metadata={"reason": "Archived because bookings exist"},
                ip=client_ip,
            )
            db.commit()
            return {"status": "archived", "message": "Resource marked as ARCHIVED to preserve audit history."}
        else:
            db.delete(res)
            audit(
                db=db,
                actor_id=user.id,
                actor_role=str(user.role),
                action="RESOURCE_DELETED",
                entity_type="Resource",
                entity_id=str(resource_id),
                metadata={"reason": "Hard deleted because no bookings existed"},
                ip=client_ip,
            )
            db.commit()
            return {"status": "deleted", "message": "Resource permanently removed."}

    @staticmethod
    def search_resources(
        db: Session,
        q: Optional[str] = None,
        category_id: Optional[uuid.UUID] = None,
        department_id: Optional[uuid.UUID] = None,
        location: Optional[str] = None,
        resource_type: Optional[ResourceType] = None,
        status_filter: Optional[ResourceStatus] = None,
        eligible_for_user: Optional[Profile] = None,
        sort_by: str = "popularity",
        page: int = 1,
        page_size: int = 12,
    ) -> Tuple[List[Resource], int]:
        query = db.query(Resource).filter(Resource.status != ResourceStatus.ARCHIVED)

        if category_id:
            query = query.filter(Resource.category_id == category_id)
        if department_id:
            query = query.filter(Resource.department_id == department_id)
        if location:
            query = query.filter(Resource.location.ilike(f"%{location}%"))
        if resource_type:
            query = query.filter(Resource.resource_type == resource_type)
        if status_filter:
            query = query.filter(Resource.status == status_filter)

        # Trigram / Fulltext / ILIKE Search
        if q and q.strip():
            search_str = q.strip()
            # Combine trigram similarity with case-insensitive contains
            query = query.filter(
                or_(
                    Resource.name.ilike(f"%{search_str}%"),
                    Resource.description.ilike(f"%{search_str}%"),
                    Resource.location.ilike(f"%{search_str}%"),
                    text("name % :q").bindparams(q=search_str),
                )
            )

        # Sorting
        if sort_by == "popularity":
            query = query.order_by(desc(Resource.popularity_count), desc(Resource.created_at))
        elif sort_by == "recently_added":
            query = query.order_by(desc(Resource.created_at))
        elif sort_by == "name":
            query = query.order_by(asc(Resource.name))
        else:
            query = query.order_by(desc(Resource.popularity_count))

        total = query.count()
        offset = (page - 1) * page_size
        items = query.offset(offset).limit(page_size).all()

        return items, total

    @staticmethod
    def evaluate_eligibility(db: Session, resource: Resource, user: Profile) -> EligibilityResponse:
        checks: List[EligibilityCheckItem] = []

        # 1. Account Standing Check
        if not user.is_active or user.suspended_reason:
            checks.append(EligibilityCheckItem(
                name="Account Standing",
                passed=False,
                message=f"Account has standing issues: {user.suspended_reason or 'Suspended'}"
            ))
        else:
            checks.append(EligibilityCheckItem(
                name="Account Standing",
                passed=True,
                message="Account in good standing with zero suspension holds."
            ))

        # 2. Role Check
        rule = db.query(ResourceRule).filter_by(resource_id=resource.id).first()
        user_role_str = str(user.role.value if hasattr(user.role, "value") else user.role).upper()
        if rule and rule.allowed_roles:
            role_passed = user_role_str in [r.upper() for r in rule.allowed_roles]
            checks.append(EligibilityCheckItem(
                name="Role Authorization",
                passed=role_passed,
                message="Authorized for your role" if role_passed else f"Restricted to {', '.join(rule.allowed_roles)}"
            ))
        else:
            checks.append(EligibilityCheckItem(
                name="Role Authorization",
                passed=True,
                message="Open to all campus roles"
            ))

        # 3. Department Check (if restricted)
        if resource.is_restricted and rule and rule.allowed_department_ids:
            dept_passed = user.department_id in rule.allowed_department_ids
            checks.append(EligibilityCheckItem(
                name="Department Enrollment",
                passed=dept_passed,
                message="Department verified" if dept_passed else "Restricted to host academic faculty."
            ))
        else:
            checks.append(EligibilityCheckItem(
                name="Department Enrollment",
                passed=True,
                message="Open cross-campus to all faculties"
            ))

        # 4. Training Prerequisite Check
        if resource.training_required:
            tr_id = rule.required_training_id if rule else None
            if tr_id:
                training = db.query(Training).filter_by(id=tr_id).first()
                record = db.query(TrainingRecord).filter(
                    TrainingRecord.user_id == user.id,
                    TrainingRecord.training_id == tr_id,
                    or_(TrainingRecord.expires_at == None, TrainingRecord.expires_at > datetime.now(timezone.utc))
                ).first()
                passed = record is not None
                t_name = training.name if training else "Safety Training"
                checks.append(EligibilityCheckItem(
                    name="Safety Certification",
                    passed=passed,
                    message=f"Verified: {t_name}" if passed else f"Prerequisite Missing: Requires completion of '{t_name}'."
                ))
            else:
                checks.append(EligibilityCheckItem(
                    name="Safety Certification",
                    passed=True,
                    message="No special certification required"
                ))
        else:
            checks.append(EligibilityCheckItem(
                name="Safety Certification",
                passed=True,
                message="No special prerequisite required"
            ))

        # 5. Active Borrow Limits
        active_bookings_count = db.query(Booking).filter(
            Booking.student_id == user.id,
            Booking.status.in_([BookingStatus.APPROVED, BookingStatus.CHECKED_OUT, BookingStatus.RETURN_PENDING])
        ).count()

        global_limit = db.query(UsageLimit).filter(UsageLimit.scope == LimitScope.GLOBAL).first()
        max_active = global_limit.max_active_bookings if global_limit else 5

        limits_passed = active_bookings_count < max_active
        checks.append(EligibilityCheckItem(
            name="Active Borrow Limit",
            passed=limits_passed,
            message=f"{active_bookings_count}/{max_active} active loans in circulation" if limits_passed else f"Limit reached: {active_bookings_count}/{max_active} active bookings."
        ))

        is_eligible = all(c.passed for c in checks)
        return EligibilityResponse(resource_id=resource.id, eligible=is_eligible, checks=checks)

    @staticmethod
    def get_date_availability(db: Session, resource: Resource, target_date: date) -> List[FreeSlotItem]:
        weekday = target_date.weekday() # 0 = Monday

        # Check operating hours
        availability = db.query(ResourceAvailability).filter(
            ResourceAvailability.resource_id == resource.id,
            ResourceAvailability.day_of_week == weekday
        ).first()

        if not availability:
            return []

        # Check blackouts
        day_start = datetime.combine(target_date, time(0, 0), tzinfo=timezone.utc)
        day_end = datetime.combine(target_date, time(23, 59, 59), tzinfo=timezone.utc)

        blackouts = db.query(ResourceBlackout).filter(
            ResourceBlackout.resource_id == resource.id,
            ResourceBlackout.start_ts <= day_end,
            ResourceBlackout.end_ts >= day_start
        ).all()

        # Get units count
        units = db.query(ResourceUnit).filter_by(resource_id=resource.id, is_active=True).all()
        total_units = len(units) or resource.quantity

        # Generate slots based on slot_minutes
        slot_minutes = resource.slot_minutes or 60
        slots: List[FreeSlotItem] = []

        curr_time = datetime.combine(target_date, availability.open_time, tzinfo=timezone.utc)
        close_time = datetime.combine(target_date, availability.close_time, tzinfo=timezone.utc)

        # Get all approved bookings for this day
        active_bookings = db.query(Booking).filter(
            Booking.resource_id == resource.id,
            Booking.status.in_([BookingStatus.APPROVED, BookingStatus.CHECKED_OUT, BookingStatus.RETURN_PENDING]),
            Booking.start_ts < day_end,
            Booking.end_ts > day_start
        ).all()

        while curr_time + timedelta(minutes=slot_minutes) <= close_time:
            slot_start = curr_time
            slot_end = curr_time + timedelta(minutes=slot_minutes)

            # Check if covered by blackout
            is_blackout = any(b.start_ts < slot_end and b.end_ts > slot_start for b in blackouts)

            if is_blackout:
                slots.append(FreeSlotItem(
                    start_time=slot_start.strftime("%H:%M"),
                    end_time=slot_end.strftime("%H:%M"),
                    available_units=0,
                    total_units=total_units,
                    available=False,
                ))
            else:
                # Count overlapping bookings
                overlapping = [
                    b for b in active_bookings
                    if b.start_ts < slot_end and b.end_ts > slot_start
                ]

                if resource.resource_type == ResourceType.FACILITY:
                    used_cap = sum(b.attendees for b in overlapping)
                    max_cap = resource.capacity or 30
                    free_cap = max(0, max_cap - used_cap)
                    slots.append(FreeSlotItem(
                        start_time=slot_start.strftime("%H:%M"),
                        end_time=slot_end.strftime("%H:%M"),
                        available_units=free_cap,
                        total_units=max_cap,
                        available=free_cap > 0,
                    ))
                else:
                    booked_count = len(overlapping)
                    free_units = max(0, total_units - booked_count)
                    slots.append(FreeSlotItem(
                        start_time=slot_start.strftime("%H:%M"),
                        end_time=slot_end.strftime("%H:%M"),
                        available_units=free_units,
                        total_units=total_units,
                        available=free_units > 0,
                    ))

            curr_time += timedelta(minutes=slot_minutes)

        return slots

    @staticmethod
    def get_30_day_calendar(db: Session, resource: Resource) -> List[DayAvailability]:
        today = datetime.now(timezone.utc).date()
        calendar_days: List[DayAvailability] = []

        for i in range(30):
            target_date = today + timedelta(days=i)
            slots = ResourceService.get_date_availability(db, resource, target_date)
            free_slots = [s for s in slots if s.available]

            if not slots:
                day_status = "closed"
            elif len(free_slots) == 0:
                day_status = "full"
            elif len(free_slots) == len(slots):
                day_status = "free"
            else:
                day_status = "partial"

            calendar_days.append(DayAvailability(
                date=target_date.isoformat(),
                status=day_status,
                free_slots_count=len(free_slots)
            ))

        return calendar_days
