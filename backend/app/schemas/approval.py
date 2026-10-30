import uuid
from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict
from .booking import BookingResponse, EligibilityCheckItem
from ..models.enums import UserRole

class ApprovalRejectRequest(BaseModel):
    reason: str = Field(..., min_length=5, max_length=1000, description="Mandatory reason for rejection")

class ApprovalRequestInfoRequest(BaseModel):
    message: str = Field(..., min_length=5, max_length=1000, description="Clarification requested from student")

class ApprovalAlternativeRequest(BaseModel):
    alternative_start_ts: datetime
    alternative_end_ts: datetime
    note: Optional[str] = Field(None, max_length=500)

class ApprovalEscalateRequest(BaseModel):
    note: str = Field(..., min_length=5, max_length=1000, description="Reason for escalation")
    target_role: Optional[UserRole] = Field(default=UserRole.MANAGER)

class ApprovalQueueItem(BaseModel):
    booking: BookingResponse
    student: Dict[str, Any]
    resource: Dict[str, Any]
    eligibility_checks: List[EligibilityCheckItem] = []
    priority_breakdown: Optional[Dict[str, Any]] = None
    has_conflicts: bool = False
    conflict_details: List[str] = []

    model_config = ConfigDict(from_attributes=True)

