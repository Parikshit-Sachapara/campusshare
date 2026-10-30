import uuid
from typing import Optional, List
from datetime import datetime
from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Profile
from ..models.enums import UserRole
from ..schemas.audit import AuditLogResponse, TimelineNarrativeItem
from ..schemas.common import PaginatedResponse
from ..core.deps import get_current_user, require_roles
from ..services.audit_service import AuditService

router = APIRouter(tags=["Audit Logs & Operational Histories"])

@router.get("/audit")
def get_audit_logs(
    actor_id: Optional[uuid.UUID] = Query(None),
    actor_role: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    entity_type: Optional[str] = Query(None),
    from_date: Optional[datetime] = Query(None),
    to_date: Optional[datetime] = Query(None),
    format: Optional[str] = Query("json", pattern="^(json|csv)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: Profile = Depends(require_roles(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    """
    Administrator endpoint: retrieves immutable audit records with filters or CSV export.
    """
    items, total = AuditService.get_admin_audit_logs(
        db=db,
        actor_id=actor_id,
        actor_role=actor_role,
        action=action,
        entity_type=entity_type,
        from_date=from_date,
        to_date=to_date,
        page=page,
        page_size=page_size if format != "csv" else 5000,
    )

    if format == "csv":
        csv_data = AuditService.export_csv(items)
        return Response(
            content=csv_data,
            media_type="text/csv",
            headers={"Content-Disposition": 'attachment; filename="campusshare_audit_logs.csv"'}
        )

    total_pages = max(1, (total + page_size - 1) // page_size)
    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )

@router.get("/bookings/{id}/timeline", response_model=List[TimelineNarrativeItem])
def get_booking_timeline(
    id: uuid.UUID,
    user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns the human-readable narrative chronological timeline for a booking.
    """
    return AuditService.get_booking_timeline(db=db, booking_id=id, user=user)

@router.get("/resources/{id}/history", response_model=List[TimelineNarrativeItem])
def get_resource_history(
    id: uuid.UUID,
    user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns complete operational and maintenance history for a resource.
    """
    return AuditService.get_resource_history(db=db, resource_id=id, user=user)

