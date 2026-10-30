import uuid
from typing import Optional, List, Tuple, Dict, Any
from datetime import datetime, timezone, timedelta, time
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, func

from ..models import (
    Resource,
    ResourceRule,
    ResourceAvailability,
    ResourceBlackout,
    ResourceUnit,
    Profile,
    Training,
    TrainingRecord,
    Booking,
    Incident,
    UsageLimit,
)
from ..models.enums import (
    ResourceType,
    ResourceStatus,
    BookingStatus,
    IncidentStatus,
    IncidentSeverity,
    LimitScope,
)
from ..schemas.booking import EligibilityResult, EligibilityCheckItem

class EligibilityService:
    """
    CampusShare High-Precision 14-Step Eligibility & Constraint Engine.
    Evaluates bookings in strict order and produces human-friendly explanations.
    """

    @classmethod
    def resolve_usage_limit(cls, db: Session, resource: Resource) -> UsageLimit:
        """
        Resolves usage limit using the 'most specific scope wins' rule:
        1. RESOURCE scope (scope_id == resource.id)
        2. CATEGORY scope (scope_id == resource.category_id)
        3. GLOBAL scope
        """
        # 1. Resource specific
        res_limit = db.query(UsageLimit).filter(
            UsageLimit.scope == LimitScope.RESOURCE,
            UsageLimit.scope_id == resource.id
        ).first()
        if res_limit:
            return res_limit

        # 2. Category specific
        cat_limit = db.query(UsageLimit).filter(
            UsageLimit.scope == LimitScope.CATEGORY,
            UsageLimit.scope_id == resource.category_id
        ).first()
        if cat_limit:
            return cat_limit

        # 3. Global limit fallback
        global_limit = db.query(UsageLimit).filter(
            UsageLimit.scope == LimitScope.GLOBAL
        ).first()
        if global_limit:
            return global_limit

        # Default fallback in-memory if table has no entry
        return UsageLimit(
            scope=LimitScope.GLOBAL,
            max_active_bookings=3,
            max_bookings_per_week=5,
            max_hours_per_week=20,
            no_show_threshold=2,
            no_show_cooldown_days=7,
        )

    @classmethod
    def evaluate(
        cls,
        db: Session,
        user: Optional[Profile],
        resource: Resource,
        start_ts: datetime,
        end_ts: datetime,
        attendees: int = 1,
    ) -> EligibilityResult:
        checks: List[EligibilityCheckItem] = []
        flagged_for_review = False
        first_failing_reason: Optional[str] = None

        now = datetime.now(timezone.utc)
        if start_ts.tzinfo is None:
            start_ts = start_ts.replace(tzinfo=timezone.utc)
        if end_ts.tzinfo is None:
            end_ts = end_ts.replace(tzinfo=timezone.utc)

        duration_minutes = int((end_ts - start_ts).total_seconds() / 60)

        # -------------------------------------------------------------
        # CHECK 1: Authenticated
        # -------------------------------------------------------------
        if not user:
            reason = "Booking unavailable: Authentication is required to request campus resources."
            checks.append(EligibilityCheckItem(name="1. Authentication", passed=False, message=reason))
            return EligibilityResult(eligible=False, first_failing_reason=reason, checks=checks, completed_items_count=0)
        checks.append(EligibilityCheckItem(name="1. Authentication", passed=True, message=f"Authenticated as {user.full_name}."))

        # -------------------------------------------------------------
        # CHECK 2: Account Active & Verified
        # -------------------------------------------------------------
        if not user.is_active or not user.is_verified:
            status_desc = "unverified" if not user.is_verified else "suspended"
            reason = f"Booking unavailable: Account is {status_desc}. {user.suspended_reason or 'Contact campus administration.'}"
            checks.append(EligibilityCheckItem(name="2. Account Standing", passed=False, message=reason))
            if not first_failing_reason:
                first_failing_reason = reason
        else:
            checks.append(EligibilityCheckItem(name="2. Account Standing", passed=True, message="Account active and verified."))

        # -------------------------------------------------------------
        # CHECK 3: Role Authorization
        # -------------------------------------------------------------
        rule = resource.rule
        user_role_str = str(user.role.value if hasattr(user.role, "value") else user.role).upper()
        if rule and rule.allowed_roles:
            role_passed = user_role_str in [r.upper() for r in rule.allowed_roles]
            if not role_passed:
                reason = f"Booking unavailable: Access restricted to [{', '.join(rule.allowed_roles)}]. Your role is {user_role_str}."
                checks.append(EligibilityCheckItem(name="3. Role Authorization", passed=False, message=reason))
                if not first_failing_reason:
                    first_failing_reason = reason
            else:
                checks.append(EligibilityCheckItem(name="3. Role Authorization", passed=True, message=f"Role {user_role_str} authorized."))
        else:
            checks.append(EligibilityCheckItem(name="3. Role Authorization", passed=True, message="Resource is open to all institutional roles."))

        # -------------------------------------------------------------
        # CHECK 4: Department Enrollment
        # -------------------------------------------------------------
        if resource.is_restricted and rule and rule.allowed_department_ids:
            dept_passed = user.department_id in rule.allowed_department_ids
            if not dept_passed:
                reason = "Booking unavailable: Restricted to students/faculty within the host academic department."
                checks.append(EligibilityCheckItem(name="4. Department Enrollment", passed=False, message=reason))
                if not first_failing_reason:
                    first_failing_reason = reason
            else:
                checks.append(EligibilityCheckItem(name="4. Department Enrollment", passed=True, message="Department enrollment verified."))
        else:
            checks.append(EligibilityCheckItem(name="4. Department Enrollment", passed=True, message="Open cross-campus to all faculties."))

        # -------------------------------------------------------------
        # CHECK 5: Prerequisite Training Completed and Not Expired
        # -------------------------------------------------------------
        if resource.training_required:
            tr_id = rule.required_training_id if rule else None
            if tr_id:
                training = db.query(Training).filter_by(id=tr_id).first()
                t_name = training.name if training else "Mandatory Training"
                rec = db.query(TrainingRecord).filter(
                    TrainingRecord.user_id == user.id,
                    TrainingRecord.training_id == tr_id,
                    or_(TrainingRecord.expires_at == None, TrainingRecord.expires_at > now)
                ).first()
                if not rec:
                    reason = f"Booking unavailable: Mandatory '{t_name}' certification has not been completed or has expired."
                    checks.append(EligibilityCheckItem(name="5. Safety Certification", passed=False, message=reason))
                    if not first_failing_reason:
                        first_failing_reason = reason
                else:
                    checks.append(EligibilityCheckItem(name="5. Safety Certification", passed=True, message=f"Verified: {t_name} certification valid."))
            else:
                checks.append(EligibilityCheckItem(name="5. Safety Certification", passed=True, message="No specific prerequisite required."))
        else:
            checks.append(EligibilityCheckItem(name="5. Safety Certification", passed=True, message="No safety training required for this equipment."))

        # -------------------------------------------------------------
        # CHECK 6: Unresolved Incidents & Restrictions (Policy-Driven)
        # -------------------------------------------------------------
        open_incidents = db.query(Incident).filter(
            Incident.reporter_id == user.id, # or related
            Incident.status.in_([IncidentStatus.REPORTED, IncidentStatus.UNDER_REVIEW, IncidentStatus.INVESTIGATING])
        ).all()
        has_high_incident = any(i.severity == IncidentSeverity.HIGH for i in open_incidents)
        has_minor_incident = any(i.severity in [IncidentSeverity.LOW, IncidentSeverity.MEDIUM] for i in open_incidents)

        if has_high_incident:
            reason = "Booking unavailable: You have a high-severity incident currently under investigation."
            checks.append(EligibilityCheckItem(name="6. Incident Clearance", passed=False, message=reason))
            if not first_failing_reason:
                first_failing_reason = reason
        elif has_minor_incident:
            # Policy-driven: Flag for staff review rather than silently blocking!
            flagged_for_review = True
            checks.append(EligibilityCheckItem(
                name="6. Incident Clearance",
                passed=True,
                severity="WARNING",
                message="Notice: Open minor incident under review; booking will require staff review."
            ))
        else:
            checks.append(EligibilityCheckItem(name="6. Incident Clearance", passed=True, message="Zero incident holds on record."))

        # -------------------------------------------------------------
        # Resolve Usage Limit
        # -------------------------------------------------------------
        limit = cls.resolve_usage_limit(db, resource)

        # -------------------------------------------------------------
        # CHECK 7: No-Show Cooldown
        # -------------------------------------------------------------
        if user.no_show_count >= limit.no_show_threshold:
            # Check last no-show date or recent incident
            cooldown_cutoff = now - timedelta(days=limit.no_show_cooldown_days)
            reason = f"Booking unavailable: Account is under a {limit.no_show_cooldown_days}-day cooldown due to {user.no_show_count} recorded no-shows."
            checks.append(EligibilityCheckItem(name="7. No-Show Cooldown", passed=False, message=reason))
            if not first_failing_reason:
                first_failing_reason = reason
        else:
            checks.append(EligibilityCheckItem(name="7. No-Show Cooldown", passed=True, message=f"No-show count ({user.no_show_count}) within acceptable limit."))

        # -------------------------------------------------------------
        # CHECK 8: Advance Booking Window
        # -------------------------------------------------------------
        if start_ts < now:
            reason = "Booking unavailable: Booking start time cannot be in the past."
            checks.append(EligibilityCheckItem(name="8. Booking Window", passed=False, message=reason))
            if not first_failing_reason:
                first_failing_reason = reason
        elif start_ts > now + timedelta(days=resource.advance_booking_days):
            reason = f"Booking unavailable: Cannot book more than {resource.advance_booking_days} days in advance."
            checks.append(EligibilityCheckItem(name="8. Booking Window", passed=False, message=reason))
            if not first_failing_reason:
                first_failing_reason = reason
        else:
            checks.append(EligibilityCheckItem(name="8. Booking Window", passed=True, message=f"Within allowed {resource.advance_booking_days}-day advance window."))

        # -------------------------------------------------------------
        # CHECK 9: Resource Status & Blackouts
        # -------------------------------------------------------------
        if resource.status != ResourceStatus.AVAILABLE:
            reason = f"Booking unavailable: Resource is currently {resource.status.value.lower()}."
            checks.append(EligibilityCheckItem(name="9. Resource Status & Blackout", passed=False, message=reason))
            if not first_failing_reason:
                first_failing_reason = reason
        else:
            # Blackout check
            blackout = db.query(ResourceBlackout).filter(
                ResourceBlackout.resource_id == resource.id,
                ResourceBlackout.start_ts < end_ts,
                ResourceBlackout.end_ts > start_ts
            ).first()
            if blackout:
                reason = f"Booking unavailable: Scheduled facility blackout: {blackout.reason}."
                checks.append(EligibilityCheckItem(name="9. Resource Status & Blackout", passed=False, message=reason))
                if not first_failing_reason:
                    first_failing_reason = reason
            else:
                checks.append(EligibilityCheckItem(name="9. Resource Status & Blackout", passed=True, message="Resource is active and clear of blackout windows."))

        # -------------------------------------------------------------
        # CHECK 10: Operating Hours Alignment
        # -------------------------------------------------------------
        start_ts_utc = start_ts.astimezone(timezone.utc)
        end_ts_utc = end_ts.astimezone(timezone.utc)
        weekday = start_ts_utc.weekday() # 0 = Monday, 6 = Sunday
        avail = db.query(ResourceAvailability).filter(
            ResourceAvailability.resource_id == resource.id,
            ResourceAvailability.day_of_week == weekday
        ).first()

        req_start_time = start_ts_utc.time()
        req_end_time = end_ts_utc.time()

        if avail:
            if req_start_time < avail.open_time or req_end_time > avail.close_time:
                reason = f"Booking unavailable: Outside operating hours for this day ({avail.open_time.strftime('%H:%M')} - {avail.close_time.strftime('%H:%M')})."
                checks.append(EligibilityCheckItem(name="10. Operating Hours", passed=False, message=reason))
                if not first_failing_reason:
                    first_failing_reason = reason
            else:
                checks.append(EligibilityCheckItem(name="10. Operating Hours", passed=True, message="Inside official lab operating hours."))
        else:
            # Default open check: between 08:00 and 22:00
            if req_start_time < time(8, 0) or req_end_time > time(22, 0):
                reason = "Booking unavailable: Outside standard campus operating hours (08:00 - 22:00)."
                checks.append(EligibilityCheckItem(name="10. Operating Hours", passed=False, message=reason))
                if not first_failing_reason:
                    first_failing_reason = reason
            else:
                checks.append(EligibilityCheckItem(name="10. Operating Hours", passed=True, message="Inside standard campus operating hours."))

        # -------------------------------------------------------------
        # CHECK 11: Duration & Slot Alignment
        # -------------------------------------------------------------
        if duration_minutes < resource.min_booking_minutes:
            reason = f"Booking unavailable: Minimum booking duration is {resource.min_booking_minutes} minutes."
            checks.append(EligibilityCheckItem(name="11. Duration & Slot Size", passed=False, message=reason))
            if not first_failing_reason:
                first_failing_reason = reason
        elif duration_minutes > resource.max_booking_minutes:
            reason = f"Booking unavailable: Maximum booking duration is {resource.max_booking_minutes} minutes ({resource.max_booking_minutes//60} hours)."
            checks.append(EligibilityCheckItem(name="11. Duration & Slot Size", passed=False, message=reason))
            if not first_failing_reason:
                first_failing_reason = reason
        elif duration_minutes % resource.slot_minutes != 0:
            reason = f"Booking unavailable: Duration must be an exact multiple of the {resource.slot_minutes}-minute slot size."
            checks.append(EligibilityCheckItem(name="11. Duration & Slot Size", passed=False, message=reason))
            if not first_failing_reason:
                first_failing_reason = reason
        else:
            checks.append(EligibilityCheckItem(name="11. Duration & Slot Size", passed=True, message=f"Duration of {duration_minutes} min is correctly aligned."))

        # -------------------------------------------------------------
        # CHECK 12: Capacity & Quantity Available
        # -------------------------------------------------------------
        if resource.resource_type == ResourceType.FACILITY:
            max_cap = resource.capacity or 1
            if attendees > max_cap:
                reason = f"Booking unavailable: Requested {attendees} attendees exceeds facility maximum capacity of {max_cap}."
                checks.append(EligibilityCheckItem(name="12. Capacity Available", passed=False, message=reason))
                if not first_failing_reason:
                    first_failing_reason = reason
            else:
                checks.append(EligibilityCheckItem(name="12. Capacity Available", passed=True, message=f"Attendee count ({attendees}) is within room capacity ({max_cap})."))
        else:
            # Equipment unit count
            active_units = db.query(ResourceUnit).filter(
                ResourceUnit.resource_id == resource.id,
                ResourceUnit.is_active == True
            ).all()
            if not active_units:
                reason = "Booking unavailable: No active physical units are currently provisioned for this equipment."
                checks.append(EligibilityCheckItem(name="12. Capacity Available", passed=False, message=reason))
                if not first_failing_reason:
                    first_failing_reason = reason
            else:
                checks.append(EligibilityCheckItem(name="12. Capacity Available", passed=True, message=f"{len(active_units)} physical unit(s) registered in fleet."))

        # -------------------------------------------------------------
        # CHECK 13: Overlap & Physical Availability
        # -------------------------------------------------------------
        # Check if the user already has an overlapping active booking
        user_overlap = db.query(Booking).filter(
            Booking.student_id == user.id,
            Booking.status.in_([
                BookingStatus.PENDING,
                BookingStatus.APPROVED,
                BookingStatus.CHECKED_OUT,
                BookingStatus.RETURN_PENDING,
                BookingStatus.OVERDUE,
            ]),
            Booking.start_ts < end_ts,
            Booking.end_ts > start_ts,
        ).first()

        if user_overlap:
            reason = f"Booking unavailable: You already have an active overlapping booking ({user_overlap.booking_code}) in this time window."
            checks.append(EligibilityCheckItem(name="13. Overlap Prevention", passed=False, message=reason))
            if not first_failing_reason:
                first_failing_reason = reason
        else:
            # Check physical inventory overlap
            if resource.resource_type == ResourceType.EQUIPMENT:
                # Find if at least one active unit has NO overlapping approved/checked-out booking
                active_units = db.query(ResourceUnit).filter(
                    ResourceUnit.resource_id == resource.id,
                    ResourceUnit.is_active == True
                ).all()
                free_unit_found = False
                for u in active_units:
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
                        free_unit_found = True
                        break
                if not free_unit_found:
                    reason = "Booking unavailable: All physical units are already reserved for the selected time slot."
                    checks.append(EligibilityCheckItem(name="13. Overlap Prevention", passed=False, message=reason))
                    if not first_failing_reason:
                        first_failing_reason = reason
                else:
                    checks.append(EligibilityCheckItem(name="13. Overlap Prevention", passed=True, message="Physical unit available with no schedule overlap."))
            else:
                # Facility: check concurrent bookings
                conflicts = db.query(Booking).filter(
                    Booking.resource_id == resource.id,
                    Booking.status.in_([
                        BookingStatus.APPROVED,
                        BookingStatus.CHECKED_OUT,
                        BookingStatus.RETURN_PENDING,
                        BookingStatus.OVERDUE,
                    ]),
                    Booking.start_ts < end_ts,
                    Booking.end_ts > start_ts,
                ).all()
                total_concurrent_attendees = sum(b.attendees for b in conflicts)
                max_cap = resource.capacity or 1
                if total_concurrent_attendees + attendees > max_cap:
                    reason = f"Booking unavailable: Facility capacity fully booked for this time window ({total_concurrent_attendees}/{max_cap} attendees reserved)."
                    checks.append(EligibilityCheckItem(name="13. Overlap Prevention", passed=False, message=reason))
                    if not first_failing_reason:
                        first_failing_reason = reason
                else:
                    checks.append(EligibilityCheckItem(name="13. Overlap Prevention", passed=True, message="Facility slot available without schedule conflicts."))

        # -------------------------------------------------------------
        # CHECK 14: Weekly Limits & Max Active Bookings
        # -------------------------------------------------------------
        # Max active bookings
        active_count = db.query(Booking).filter(
            Booking.student_id == user.id,
            Booking.status.in_([BookingStatus.PENDING, BookingStatus.APPROVED, BookingStatus.CHECKED_OUT])
        ).count()

        # Rolling 7 days bookings count and hours
        one_week_ago = now - timedelta(days=7)
        weekly_bookings = db.query(Booking).filter(
            Booking.student_id == user.id,
            Booking.start_ts >= one_week_ago,
            Booking.status.in_([
                BookingStatus.APPROVED,
                BookingStatus.CHECKED_OUT,
                BookingStatus.RETURN_PENDING,
                BookingStatus.COMPLETED,
            ])
        ).all()

        weekly_count = len(weekly_bookings)
        weekly_hours = sum((b.end_ts - b.start_ts).total_seconds() / 3600.0 for b in weekly_bookings)
        requested_hours = duration_minutes / 60.0

        if active_count >= limit.max_active_bookings:
            reason = f"Booking unavailable: You have reached the maximum allowed active bookings ({active_count}/{limit.max_active_bookings})."
            checks.append(EligibilityCheckItem(name="14. Institutional Usage Limits", passed=False, message=reason))
            if not first_failing_reason:
                first_failing_reason = reason
        elif weekly_count >= limit.max_bookings_per_week:
            reason = f"Booking unavailable: You have reached your weekly booking limit ({weekly_count}/{limit.max_bookings_per_week})."
            checks.append(EligibilityCheckItem(name="14. Institutional Usage Limits", passed=False, message=reason))
            if not first_failing_reason:
                first_failing_reason = reason
        elif weekly_hours + requested_hours > limit.max_hours_per_week:
            reason = f"Booking unavailable: Requested hours would exceed your weekly limit of {limit.max_hours_per_week} hours (currently used: {weekly_hours:.1f}h)."
            checks.append(EligibilityCheckItem(name="14. Institutional Usage Limits", passed=False, message=reason))
            if not first_failing_reason:
                first_failing_reason = reason
        else:
            checks.append(EligibilityCheckItem(
                name="14. Institutional Usage Limits",
                passed=True,
                message=f"Usage within limits (Active: {active_count}/{limit.max_active_bookings}, Weekly: {weekly_hours:.1f}/{limit.max_hours_per_week}h)."
            ))

        # Calculate completeness
        passed_count = sum(1 for c in checks if c.passed)
        is_eligible = (first_failing_reason is None)

        return EligibilityResult(
            eligible=is_eligible,
            flagged_for_review=flagged_for_review,
            first_failing_reason=first_failing_reason,
            checks=checks,
            completed_items_count=passed_count,
            total_required_items=len(checks),
            matched_limit_scope=limit.scope.value,
        )

    @classmethod
    def suggest_next_free_slots(
        cls,
        db: Session,
        resource: Resource,
        start_ts: datetime,
        duration_minutes: int,
        count: int = 3,
    ) -> List[Dict[str, datetime]]:
        """
        Calculates the next available booking slots when a conflict or block occurs.
        """
        suggestions: List[Dict[str, datetime]] = []
        curr = start_ts + timedelta(minutes=resource.slot_minutes)
        max_lookahead = start_ts + timedelta(days=7)

        while curr < max_lookahead and len(suggestions) < count:
            slot_end = curr + timedelta(minutes=duration_minutes)

            # Operating hours check
            weekday = curr.weekday()
            avail = db.query(ResourceAvailability).filter(
                ResourceAvailability.resource_id == resource.id,
                ResourceAvailability.day_of_week == weekday
            ).first()

            open_time = avail.open_time if avail else time(8, 0)
            close_time = avail.close_time if avail else time(20, 0)

            if curr.time() < open_time or slot_end.time() > close_time:
                # Jump to start of next day
                curr = datetime.combine(curr.date() + timedelta(days=1), open_time, tzinfo=timezone.utc)
                continue

            # Check overlap on units/facility
            if resource.resource_type == ResourceType.EQUIPMENT:
                units = db.query(ResourceUnit).filter(
                    ResourceUnit.resource_id == resource.id,
                    ResourceUnit.is_active == True
                ).all()
                has_free = False
                for u in units:
                    c = db.query(Booking).filter(
                        Booking.unit_id == u.id,
                        Booking.status.in_([
                            BookingStatus.APPROVED,
                            BookingStatus.CHECKED_OUT,
                            BookingStatus.RETURN_PENDING,
                            BookingStatus.OVERDUE,
                        ]),
                        Booking.start_ts < slot_end,
                        Booking.end_ts > curr,
                    ).first()
                    if not c:
                        has_free = True
                        break
                if has_free:
                    suggestions.append({"start_ts": curr.isoformat(), "end_ts": slot_end.isoformat()})
            else:
                conflicts = db.query(Booking).filter(
                    Booking.resource_id == resource.id,
                    Booking.status.in_([
                        BookingStatus.APPROVED,
                        BookingStatus.CHECKED_OUT,
                        BookingStatus.RETURN_PENDING,
                        BookingStatus.OVERDUE,
                    ]),
                    Booking.start_ts < slot_end,
                    Booking.end_ts > curr,
                ).all()
                if not conflicts:
                    suggestions.append({"start_ts": curr.isoformat(), "end_ts": slot_end.isoformat()})

            curr += timedelta(minutes=resource.slot_minutes)

        return suggestions
