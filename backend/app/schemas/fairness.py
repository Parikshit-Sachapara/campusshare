import uuid
from typing import Optional, Dict, Any, List
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict
from ..models.enums import LimitScope

class PriorityWeightsUpdate(BaseModel):
    wN: float = Field(..., ge=0, le=100, description="Recent non-usage weight")
    wD: float = Field(..., ge=0, le=100, description="Department / Keyword match weight")
    wE: float = Field(..., ge=0, le=100, description="Eligibility completeness weight")
    wA: float = Field(..., ge=0, le=100, description="Hours waiting weight")

class UsageLimitCreate(BaseModel):
    scope: LimitScope = LimitScope.GLOBAL
    scope_id: Optional[uuid.UUID] = None
    max_active_bookings: int = Field(3, ge=1)
    max_bookings_per_week: int = Field(5, ge=1)
    max_hours_per_week: int = Field(20, ge=1)
    no_show_threshold: int = Field(2, ge=1)
    no_show_cooldown_days: int = Field(7, ge=1)

class UsageLimitUpdate(BaseModel):
    max_active_bookings: Optional[int] = Field(None, ge=1)
    max_bookings_per_week: Optional[int] = Field(None, ge=1)
    max_hours_per_week: Optional[int] = Field(None, ge=1)
    no_show_threshold: Optional[int] = Field(None, ge=1)
    no_show_cooldown_days: Optional[int] = Field(None, ge=1)

class UsageLimitResponse(BaseModel):
    id: uuid.UUID
    scope: LimitScope
    scope_id: Optional[uuid.UUID] = None
    max_active_bookings: int
    max_bookings_per_week: int
    max_hours_per_week: int
    no_show_threshold: int
    no_show_cooldown_days: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class FairnessProfileResponse(BaseModel):
    user_id: uuid.UUID
    user_name: str
    department_name: Optional[str] = None
    no_show_count: int
    standing_score: int
    active_bookings_count: int
    weekly_bookings_count: int
    weekly_hours_used: float
    effective_limits: Dict[str, Any]
    formula_explanation: str
    current_weights: Dict[str, float]

