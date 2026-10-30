import re
from typing import Dict, Any, Tuple, Optional
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..models import (
    Booking,
    Resource,
    Profile,
    PlatformSetting,
    UsageLimit,
    Department,
)
from ..models.enums import BookingStatus, LimitScope
from .eligibility_service import EligibilityService

class FairnessService:
    """
    CampusShare Algorithmic Fairness & Priority Allocation Engine.
    Formula: P = wN*N + wD*D + wE*E + wA*A
    Deterministic, transparent, reproducible priority scoring.
    """

    DEFAULT_WEIGHTS = {
        "wN": 40.0,
        "wD": 30.0,
        "wE": 20.0,
        "wA": 10.0,
    }

    @classmethod
    def get_weights(cls, db: Session) -> Dict[str, float]:
        setting = db.query(PlatformSetting).filter_by(key="priority_weights").first()
        if setting and isinstance(setting.value, dict):
            w = setting.value
            try:
                return {
                    "wN": float(w.get("wN", 40.0)),
                    "wD": float(w.get("wD", 30.0)),
                    "wE": float(w.get("wE", 20.0)),
                    "wA": float(w.get("wA", 10.0)),
                }
            except (ValueError, TypeError):
                pass
        return dict(cls.DEFAULT_WEIGHTS)

    @classmethod
    def calculate_priority(
        cls,
        db: Session,
        user: Profile,
        resource: Resource,
        purpose: str = "",
        project_name: Optional[str] = None,
        hours_waiting: float = 0.0,
        completed_eligibility_items: int = 14,
        total_required_items: int = 14,
    ) -> Tuple[float, Dict[str, Any]]:
        """
        Calculates priority score P (0.00 - 100.00) and structured audit breakdown.
        """
        weights = cls.get_weights(db)
        wN = weights["wN"]
        wD = weights["wD"]
        wE = weights["wE"]
        wA = weights["wA"]

        now = datetime.now(timezone.utc)
        thirty_days_ago = now - timedelta(days=30)

        # ---------------------------------------------------------
        # Factor N: Recent Non-Usage (Fair rotation)
        # N = 1 - min(1, uses_of_this_resource_in_last_30_days / 3)
        # ---------------------------------------------------------
        recent_uses = db.query(Booking).filter(
            Booking.student_id == user.id,
            Booking.resource_id == resource.id,
            Booking.start_ts >= thirty_days_ago,
            Booking.status.in_([
                BookingStatus.APPROVED,
                BookingStatus.CHECKED_OUT,
                BookingStatus.RETURN_PENDING,
                BookingStatus.COMPLETED,
            ])
        ).count()

        N = 1.0 - min(1.0, float(recent_uses) / 3.0)
        n_reason = (
            "Zero bookings in last 30 days (maximum priority)"
            if recent_uses == 0
            else f"{recent_uses} booking(s) of this resource in last 30 days"
        )

        # ---------------------------------------------------------
        # Factor D: Department & Purpose Alignment (Deterministic)
        # 1.0 if purpose/project keywords match category or user.dept matches resource.dept
        # 0.5 partial
        # 0.2 otherwise
        # ---------------------------------------------------------
        same_dept = (user.department_id is not None and user.department_id == resource.department_id)

        # Tokenize purpose and project keywords
        text_corpus = f"{purpose} {project_name or ''} {resource.name}".lower()
        cat_name = resource.category.name.lower() if resource.category else ""
        resource_keywords = set(re.findall(r"\w+", f"{cat_name} {resource.name.lower()}"))
        user_keywords = set(re.findall(r"\w+", text_corpus))
        keyword_overlap = user_keywords.intersection(resource_keywords)

        if same_dept or cat_name in user_keywords:
            D = 1.0
            d_reason = "Host department alignment or direct category match"
        elif len(keyword_overlap) > 0:
            D = 0.5
            d_reason = f"Partial academic keyword alignment: [{', '.join(list(keyword_overlap)[:3])}]"
        else:
            D = 0.2
            d_reason = "Cross-disciplinary exploratory access"

        # ---------------------------------------------------------
        # Factor E: Eligibility Completeness
        # E = completed_eligibility_items / total_required_items
        # ---------------------------------------------------------
        total_items = max(1, total_required_items)
        E = min(1.0, float(completed_eligibility_items) / float(total_items))
        e_reason = f"Completed {completed_eligibility_items}/{total_items} verification requirements"

        # ---------------------------------------------------------
        # Factor A: Queue Waiting Time
        # A = min(1, hours_waiting / 72)
        # ---------------------------------------------------------
        A = min(1.0, max(0.0, float(hours_waiting) / 72.0))
        a_reason = f"Waited {hours_waiting:.1f} hours in queue (max cap 72h)"

        # ---------------------------------------------------------
        # Total Weighted Score
        # ---------------------------------------------------------
        weighted_N = wN * N
        weighted_D = wD * D
        weighted_E = wE * E
        weighted_A = wA * A

        total_score = round(weighted_N + weighted_D + weighted_E + weighted_A, 2)

        breakdown = {
            "formula": "P = wN*N + wD*D + wE*E + wA*A",
            "weights": weights,
            "N": {
                "value": round(N, 3),
                "weight": wN,
                "weighted": round(weighted_N, 2),
                "reason": n_reason,
            },
            "D": {
                "value": round(D, 3),
                "weight": wD,
                "weighted": round(weighted_D, 2),
                "reason": d_reason,
            },
            "E": {
                "value": round(E, 3),
                "weight": wE,
                "weighted": round(weighted_E, 2),
                "reason": e_reason,
            },
            "A": {
                "value": round(A, 3),
                "weight": wA,
                "weighted": round(weighted_A, 2),
                "reason": a_reason,
            },
            "total_score": total_score,
        }

        return total_score, breakdown

    @classmethod
    def get_user_fairness_profile(cls, db: Session, user: Profile) -> Dict[str, Any]:
        """
        Gathers user usage metrics vs limits, no-shows, and priority calculation explanation.
        """
        now = datetime.now(timezone.utc)
        one_week_ago = now - timedelta(days=7)

        active_count = db.query(Booking).filter(
            Booking.student_id == user.id,
            Booking.status.in_([BookingStatus.PENDING, BookingStatus.APPROVED, BookingStatus.CHECKED_OUT])
        ).count()

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

        # Global limit
        global_limit = db.query(UsageLimit).filter_by(scope=LimitScope.GLOBAL).first()
        limits_dict = {
            "max_active_bookings": global_limit.max_active_bookings if global_limit else 3,
            "max_bookings_per_week": global_limit.max_bookings_per_week if global_limit else 5,
            "max_hours_per_week": global_limit.max_hours_per_week if global_limit else 20,
            "no_show_threshold": global_limit.no_show_threshold if global_limit else 2,
            "no_show_cooldown_days": global_limit.no_show_cooldown_days if global_limit else 7,
        }

        dept_name = user.department.name if user.department else "Undeclared"
        standing_score = max(0, 100 - (user.no_show_count * 25))

        return {
            "user_id": user.id,
            "user_name": user.full_name,
            "department_name": dept_name,
            "no_show_count": user.no_show_count,
            "standing_score": standing_score,
            "active_bookings_count": active_count,
            "weekly_bookings_count": weekly_count,
            "weekly_hours_used": round(weekly_hours, 2),
            "effective_limits": limits_dict,
            "current_weights": cls.get_weights(db),
            "formula_explanation": (
                "Priority score is computed using the formula P = wN*N + wD*D + wE*E + wA*A. "
                "Factor N rewards users who haven't used the resource recently (anti-monopoly). "
                "Factor D awards higher priority to projects aligned with the host department or curriculum. "
                "Factor E measures complete prerequisite certifications. "
                "Factor A increases linearly with queue waiting time."
            ),
        }

