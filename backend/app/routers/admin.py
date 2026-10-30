import os
import sys
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session
from sqlalchemy import text

from ..database import get_db
from ..models import (
    Profile,
    UserRole,
    AuditLog,
    Booking,
    BookingCondition,
    Incident,
    IncidentComment,
    Notification,
    WaitingList,
    ResourceUnit,
    UnitCondition,
)
from ..core.deps import require_roles
from ..core.exceptions import CampusShareException
from ..schemas.common import SuccessResponse

router = APIRouter(prefix="/admin", tags=["Admin Operations"])

@router.post("/reset-demo-data", response_model=SuccessResponse)
def reset_demo_data(
    request: Request,
    user: Profile = Depends(require_roles(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    """
    Judges & Admin reset button: Resets all dynamic booking and incident records
    and re-runs the initial idempotent seed so the live journey can be re-tested cleanly.
    Audited for security and transparency.
    """
    client_ip = request.client.host if request and request.client else "127.0.0.1"

    try:
        # Check dialect
        is_postgres = db.bind.dialect.name == "postgresql"
        if is_postgres:
            db.execute(text("SET session_replication_role = 'replica';"))

        # Clean up dynamic transactional entities
        db.query(IncidentComment).delete()
        db.query(Incident).delete()
        db.query(BookingCondition).delete()
        db.query(Notification).delete()
        db.query(WaitingList).delete()
        db.query(Booking).delete()

        # Reset all units to pristine active condition
        db.query(ResourceUnit).update({
            ResourceUnit.condition: UnitCondition.EXCELLENT,
            ResourceUnit.is_active: True,
        })
        db.commit()

        if is_postgres:
            db.execute(text("SET session_replication_role = 'origin';"))
            db.commit()

        # Run seed to repopulate fresh bookings and demo records
        from scripts.seed import seed
        seed()

        # Write immutable audit log
        audit = AuditLog(
            action="DEMO_DATA_RESET",
            entity_type="System",
            entity_id="ALL",
            actor_id=user.id,
            actor_role=user.role.value if hasattr(user.role, 'value') else str(user.role),
            ip=client_ip,
            audit_metadata={
                "triggered_by": user.email,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "status": "SUCCESS",
            },
        )
        db.add(audit)
        db.commit()

        return SuccessResponse(message="Demo environment successfully reset to fresh factory state.")
    except Exception as e:
        db.rollback()
        if db.bind.dialect.name == "postgresql":
            try:
                db.execute(text("SET session_replication_role = 'origin';"))
                db.commit()
            except Exception:
                pass
        raise CampusShareException(
            code="RESET_FAILED",
            message=f"Failed to reset demo data: {str(e)}",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

