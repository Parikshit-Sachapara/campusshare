import uuid
from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict
from ..models.enums import IncidentType, IncidentSeverity, IncidentStatus

class IncidentCreate(BaseModel):
    booking_id: Optional[uuid.UUID] = Field(None, description="Linked booking if related")
    resource_id: uuid.UUID = Field(..., description="Linked resource")
    type: IncidentType
    severity: IncidentSeverity = IncidentSeverity.MEDIUM
    description: str = Field(..., min_length=10, max_length=3000)
    evidence_urls: List[str] = Field(default=[], max_length=10)

class IncidentStatusUpdate(BaseModel):
    status: IncidentStatus
    resolution: Optional[str] = Field(None, max_length=3000, description="Mandatory when moving to RESOLVED or CLOSED")
    penalty_apply_suspension: bool = Field(False, description="Manager/Admin option to restrict student account")
    penalty_suspension_reason: Optional[str] = Field(None, max_length=500)

class IncidentCommentCreate(BaseModel):
    comment: str = Field(..., min_length=2, max_length=2000)

class IncidentCommentResponse(BaseModel):
    id: uuid.UUID
    incident_id: uuid.UUID
    author_id: uuid.UUID
    author_name: Optional[str] = None
    author_role: Optional[str] = None
    comment: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class IncidentResponse(BaseModel):
    id: uuid.UUID
    booking_id: Optional[uuid.UUID] = None
    resource_id: uuid.UUID
    resource_name: Optional[str] = None
    reporter_id: uuid.UUID
    reporter_name: Optional[str] = None
    type: IncidentType
    severity: IncidentSeverity
    description: str
    evidence_urls: List[str] = []
    status: IncidentStatus
    reviewer_id: Optional[uuid.UUID] = None
    reviewer_name: Optional[str] = None
    resolution: Optional[str] = None
    resolved_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    comments: List[IncidentCommentResponse] = []

    model_config = ConfigDict(from_attributes=True)

