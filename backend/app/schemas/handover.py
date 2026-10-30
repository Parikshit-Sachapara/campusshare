import uuid
from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict
from ..models.enums import UnitCondition, ConditionPhase, BookingStatus

class CheckoutRequest(BaseModel):
    booking_code_or_token: str = Field(..., description="Booking code (e.g. CS-2026-00042) or signed QR token")
    condition: UnitCondition = Field(default=UnitCondition.EXCELLENT, description="Initial inspection condition")
    notes: Optional[str] = Field(None, max_length=1000)
    photo_urls: List[str] = Field(default=[], max_length=6, description="Up to 6 condition photos")
    confirmed_in_person: bool = Field(False, description="Owner confirms student physically accepted handover")

class FacilityOccupancyRequest(BaseModel):
    headcount: int = Field(1, ge=1, description="Actual attendee headcount arriving")
    room_condition: UnitCondition = Field(default=UnitCondition.EXCELLENT)
    notes: Optional[str] = Field(None, max_length=1000)
    photo_urls: List[str] = Field(default=[], max_length=6)

class ReturnRequest(BaseModel):
    notes: Optional[str] = Field(None, max_length=1000)
    photo_urls: List[str] = Field(default=[], max_length=6, description="Return state photos")

class VerifyReturnRequest(BaseModel):
    final_condition: UnitCondition = Field(default=UnitCondition.EXCELLENT)
    notes: Optional[str] = Field(None, max_length=1000)
    damage_observed: bool = Field(False, description="Flag if item has visible damage compared to pickup")
    item_missing: bool = Field(False, description="Flag if accessories or unit are missing")
    incident_description: Optional[str] = Field(None, max_length=2000, description="Required if damage or missing flagged")

class BookingConditionResponse(BaseModel):
    id: uuid.UUID
    booking_id: uuid.UUID
    phase: ConditionPhase
    condition: UnitCondition
    notes: Optional[str] = None
    photo_urls: List[str] = []
    recorded_by: uuid.UUID
    recorded_by_name: Optional[str] = None
    student_confirmed: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class ReturnComparisonResponse(BaseModel):
    booking_id: uuid.UUID
    booking_code: str
    status: BookingStatus
    pickup_condition: Optional[BookingConditionResponse] = None
    return_condition: Optional[BookingConditionResponse] = None
    incident_created: Optional[Dict[str, Any]] = None

