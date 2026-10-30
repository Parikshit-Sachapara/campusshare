import uuid
from typing import List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Profile
from ..schemas.notification import NotificationResponse, UnreadCountResponse
from ..schemas.common import PaginatedResponse, SuccessResponse
from ..core.deps import get_current_user
from ..services.notification_service import NotificationService

router = APIRouter(prefix="/notifications", tags=["Notifications & Polling"])

@router.get("", response_model=PaginatedResponse[NotificationResponse])
def get_notifications(
    unread_only: bool = Query(False),
    page: int = Query(1, ge=1),
    page_size: int = Query(15, ge=1, le=50),
    user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns paginated notifications for current user.
    """
    items, total, unread_count = NotificationService.get_user_notifications(
        db=db, user_id=user.id, unread_only=unread_only, page=page, page_size=page_size
    )
    total_pages = max(1, (total + page_size - 1) // page_size)
    return PaginatedResponse(
        items=[NotificationResponse.model_validate(n) for n in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )

@router.get("/unread-count", response_model=UnreadCountResponse)
def get_unread_count(
    user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Lightweight endpoint polled by frontend client every 15 seconds.
    """
    count = NotificationService.get_unread_count(db=db, user_id=user.id)
    return UnreadCountResponse(unread_count=count)

@router.patch("/{id}/read", response_model=NotificationResponse)
def mark_notification_read(
    id: uuid.UUID,
    user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Marks a single notification as read.
    """
    notif = NotificationService.mark_as_read(db=db, notification_id=id, user_id=user.id)
    return NotificationResponse.model_validate(notif)

@router.patch("/read-all", response_model=SuccessResponse)
def mark_all_notifications_read(
    user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Marks all notifications for current user as read.
    """
    count = NotificationService.mark_all_as_read(db=db, user_id=user.id)
    return SuccessResponse(message=f"Marked {count} notification(s) as read.")

