import uuid
from typing import Optional, Dict, Any, List
from datetime import datetime
from pydantic import BaseModel, ConfigDict

class AuditLogResponse(BaseModel):
    id: int
    actor_id: Optional[uuid.UUID] = None
    actor_name: Optional[str] = None
    actor_role: Optional[str] = None
    action: str
    entity_type: str
    entity_id: Optional[str] = None
    resource_id: Optional[uuid.UUID] = None
    booking_id: Optional[uuid.UUID] = None
    audit_metadata: Optional[Dict[str, Any]] = None
    ip: Optional[str] = None
    created_at: datetime
    narrative: str

    model_config = ConfigDict(from_attributes=True)

class TimelineNarrativeItem(BaseModel):
    id: int
    action: str
    narrative: str
    actor_name: str
    actor_role: Optional[str] = None
    created_at: datetime
    metadata: Optional[Dict[str, Any]] = None

