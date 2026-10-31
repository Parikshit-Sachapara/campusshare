import uuid
from typing import Optional
from sqlalchemy.orm import Session
from ..models import Notification

def notify(
    db: Session,
    user_id: Optional[uuid.UUID],
    type: str,
    title: str,
    body: str,
    link: Optional[str] = None,
) -> Optional[Notification]:
    """
    Inserts a user notification inside the active DB transaction for 15s client polling.
    Safely ignores if user_id is None.
    """
    if not user_id:
        return None
    try:
        notif = Notification(
            user_id=user_id,
            type=type,
            title=title,
            body=body,
            link=link,
            is_read=False,
        )
        db.add(notif)
        db.flush()
        return notif
    except Exception:
        return None
