from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..core.deps import get_current_user, require_roles
from ..models import Profile, UserRole
from ..services.analytics_service import AnalyticsService

router = APIRouter(prefix="/analytics", tags=["Analytics & Campus Pulse"])

@router.get("/overview")
def get_analytics_overview(
    db: Session = Depends(get_db),
    current_user: Profile = Depends(require_roles([UserRole.MANAGER, UserRole.ADMIN])),
):
    """
    Returns platform-wide institutional aggregates, department-wise utilization %,
    no-show rate, monthly trends, status distributions, and peak hours matrix.
    """
    return AnalyticsService.get_dashboard_metrics(db)

@router.get("/campus-pulse")
def get_campus_pulse(
    date: Optional[str] = Query(None, description="Target date YYYY-MM-DD"),
    hour: Optional[int] = Query(None, ge=8, le=20, description="Hour of the day 8-20"),
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user),
):
    """
    CAMPUS PULSE:
    Interactive campus floor plan utilization and room telemetry.
    Returns styled room nodes for Blocks A, B, and C with live booking occupancy.
    """
    return AnalyticsService.get_campus_pulse(db, target_date=date, hour=hour)
