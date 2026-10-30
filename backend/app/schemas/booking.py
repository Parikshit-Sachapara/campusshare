import uuid
from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict
from ..models.enums import BookingStatus, ResourceType, UnitCondition

class EligibilityCheckItem(BaseModel):
    name: str
    passed: bool
    message: str
    severity: str = "ERROR" # INFO, WARNING, ERROR

class EligibilityResult(BaseModel):
    eligible: bool
    flagged_for_review: bool = False
    first_failing_reason: Optional[str] = None
    checks: List[EligibilityCheckItem] = []
    completed_items_count: int = 0
    total_required_items: int = 14
    matched_limit_scope: Optional[str] = None

class BookingValidateRequest(BaseModel):
    resource_id: uuid.UUID
    start_ts: datetime
    end_ts: datetime
    attendees: int = Field(1, ge=1)
    purpose: str = Field(..., min_length=5, max_length=1000)
    project_name: Optional[str] = None

class BookingValidateResponse(BaseModel):
    eligible: bool
    first_failing_reason: Optional[str] = None
    checks: List[EligibilityCheckItem]
    priority_preview: Optional[Dict[str, Any]] = None
    suggested_slots: List[Dict[str, Any]] = []

class BookingCreate(BaseModel):
    resource_id: uuid.UUID
    start_ts: datetime
    end_ts: datetime
    attendees: int = Field(1, ge=1)
    purpose: str = Field(..., min_length=5, max_length=1000, description="Academic / research purpose")
    project_name: Optional[str] = Field(None, max_length=150)

class BookingCancelRequest(BaseModel):
    reason: Optional[str] = Field(None, max_length=500)

class BookingOverridePriorityRequest(BaseModel):
    priority_score: float = Field(..., ge=0.0, le=100.0)
    reason: str = Field(..., min_length=5, max_length=500, description="Mandatory reason for priority override")

class TimelineItem(BaseModel):
    id: int
    action: str
    actor_name: Optional[str] = None
    actor_role: Optional[str] = None
    created_at: datetime
    metadata: Optional[Dict[str, Any]] = None

class BookingResponse(BaseModel):
    id: uuid.UUID
    booking_code: str
    resource_id: uuid.UUID
    resource_name: Optional[str] = None
    resource_type: Optional[ResourceType] = None
    student_id: uuid.UUID
    student_name: Optional[str] = None
    student_email: Optional[str] = None
    unit_id: Optional[uuid.UUID] = None
    unit_code: Optional[str] = None
    start_ts: datetime
    end_ts: datetime
    attendees: int
    purpose: str
    project_name: Optional[str] = None
    status: BookingStatus
    approver_id: Optional[uuid.UUID] = None
    approver_name: Optional[str] = None
    approved_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    alternative_start_ts: Optional[datetime] = None
    alternative_end_ts: Optional[datetime] = None
    collected_at: Optional[datetime] = None
    returned_at: Optional[datetime] = None
    cancellation_reason: Optional[str] = None
    priority_score: Optional[float] = None
    priority_breakdown: Optional[Dict[str, Any]] = None
    override_by: Optional[uuid.UUID] = None
    override_reason: Optional[str] = None
    version: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class BookingDetailResponse(BookingResponse):
    timeline: List[TimelineItem] = []
    eligibility_checks: List[EligibilityCheckItem] = []
