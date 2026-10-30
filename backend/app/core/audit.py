import uuid
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from ..models import AuditLog

def audit(
    db: Session,
    actor_id: Optional[uuid.UUID],
    actor_role: Optional[str],
    action: str,
    entity_type: str,
    entity_id: Optional[str] = None,
    resource_id: Optional[uuid.UUID] = None,
    booking_id: Optional[uuid.UUID] = None,
    metadata: Optional[Dict[str, Any]] = None,
    ip: Optional[str] = None,
) -> AuditLog:
    """
    Appends an immutable audit log record to the database in the current transaction.
    DB trigger prevents any UPDATE or DELETE operations on this table.
    """
    log_entry = AuditLog(
        actor_id=actor_id,
        actor_role=str(actor_role) if actor_role else None,
        action=action,
        entity_type=entity_type,
        entity_id=str(entity_id) if entity_id else None,
        resource_id=resource_id,
        booking_id=booking_id,
        audit_metadata=metadata or {},
        ip=ip,
    )
    db.add(log_entry)
    db.flush()
    return log_entry
