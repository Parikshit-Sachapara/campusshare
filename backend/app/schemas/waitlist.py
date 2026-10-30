import uuid
from typing import Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict
from ..models.enums import WaitlistStatus

class WaitlistCreate(BaseModel):
    resource_id: uuid.UUID
    desired_start_ts: datetime
    desired_end_ts: datetime

class WaitlistResponse(BaseModel):
    id: uuid.UUID
    resource_id: uuid.UUID
    resource_name: Optional[str] = None
    student_id: uuid.UUID
    student_name: Optional[str] = None
    desired_start_ts: datetime
    desired_end_ts: datetime
    priority_score: float
    priority_breakdown: Optional[Dict[str, Any]] = None
    status: WaitlistStatus
    position: Optional[int] = None
    offered_at: Optional[datetime] = None
    offer_expires_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

