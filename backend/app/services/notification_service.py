import uuid
import logging
from typing import Optional, List, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import desc

from ..models import Notification, Profile
from ..schemas.notification import NotificationResponse

logger = logging.getLogger("campusshare.email_adapter")

class EmailAdapter:
    """
    Optional Email Notification Adapter.
    Outputs cleanly formatted transactional emails to console/logger by default.
    """

    @classmethod
    def send_email(cls, to_email: str, subject: str, html_body: str) -> bool:
        logger.info(
            f"\n"
            f"============================================================\n"
            f"📧 [CAMPUSSHARE OUTBOUND EMAIL NOTIFICATION]\n"
            f"To:      {to_email}\n"
            f"Subject: {subject}\n"
            f"Body:    {html_body}\n"
            f"============================================================"
        )
        return True


class NotificationService:
    """
    In-App Notification and 15s Polling Engine with optional email adapter.
    """

    @classmethod
    def get_user_notifications(
        cls,
        db: Session,
        user_id: uuid.UUID,
        unread_only: bool = False,
        page: int = 1,
        page_size: int = 15,
    ) -> Tuple[List[Notification], int, int]:
        query = db.query(Notification).filter(Notification.user_id == user_id)
        if unread_only:
            query = query.filter(Notification.is_read == False)

        total = query.count()
        unread_count = db.query(Notification).filter(
            Notification.user_id == user_id,
            Notification.is_read == False,
        ).count()

        offset = (page - 1) * page_size
        items = query.order_by(desc(Notification.created_at)).offset(offset).limit(page_size).all()
        return items, total, unread_count

    @classmethod
    def get_unread_count(cls, db: Session, user_id: uuid.UUID) -> int:
        return db.query(Notification).filter(
            Notification.user_id == user_id,
            Notification.is_read == False,
        ).count()

    @classmethod
    def mark_as_read(cls, db: Session, notification_id: uuid.UUID, user_id: uuid.UUID) -> Notification:
        notif = db.query(Notification).filter_by(id=notification_id, user_id=user_id).first()
        if notif:
            notif.is_read = True
            db.commit()
            db.refresh(notif)
        return notif

    @classmethod
    def mark_all_as_read(cls, db: Session, user_id: uuid.UUID) -> int:
        updated = db.query(Notification).filter_by(
            user_id=user_id, is_read=False
        ).update({"is_read": True})
        db.commit()
        return updated

