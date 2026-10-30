import uuid
from typing import Optional, List, Dict, Any, Union
from datetime import datetime, date, time
from pydantic import BaseModel, Field, ConfigDict, AliasChoices, model_validator
from ..models.enums import ResourceType, ResourceStatus, UnitCondition

class ResourceImageSchema(BaseModel):
    id: uuid.UUID
    url: str
    is_primary: bool
    sort_order: int
    model_config = ConfigDict(from_attributes=True)

class ResourceUnitSchema(BaseModel):
    id: uuid.UUID
    unit_code: str
    condition: UnitCondition
    is_active: bool
    model_config = ConfigDict(from_attributes=True)

class ResourceUnitCreate(BaseModel):
    unit_code: str = Field(..., min_length=2, max_length=50)
    condition: Optional[UnitCondition] = UnitCondition.EXCELLENT

class ResourceRuleSchema(BaseModel):
    id: uuid.UUID
    allowed_department_ids: List[uuid.UUID]
    allowed_roles: List[str]
    required_training_id: Optional[uuid.UUID]
    requires_faculty_approval: bool
    usage_instructions: Optional[str]
    model_config = ConfigDict(from_attributes=True)

class ResourceAvailabilitySchema(BaseModel):
    id: uuid.UUID
    day_of_week: int
    open_time: time
    close_time: time
    model_config = ConfigDict(from_attributes=True)

class ResourceBlackoutSchema(BaseModel):
    id: uuid.UUID
    start_ts: datetime
    end_ts: datetime
    reason: str
    model_config = ConfigDict(from_attributes=True)

class ResourceCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=200, examples=["Nikon D850 DSLR Kit"])
    description: Optional[str] = Field(None, examples=["Full frame professional DSLR with 24-70mm f/2.8 lens"])
    category_id: Union[str, uuid.UUID] = Field(..., description="Category Name (e.g. Photography, Computing, Electronics) or Category UUID", examples=["Photography"])
    department_id: Union[str, uuid.UUID] = Field(
        ...,
        validation_alias=AliasChoices("department_id", "dept_id"),
        description="Department code (e.g. CS, EC, ME, MD, PH) or Department UUID",
        examples=["MD"]
    )
    location: str = Field(..., min_length=2, max_length=200, examples=["Media Lab Room 302"])

    @model_validator(mode="before")
    @classmethod
    def normalize_dept_id(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if "dept_id" in data and not data.get("department_id"):
                data["department_id"] = data["dept_id"]
        return data
    resource_type: Optional[ResourceType] = ResourceType.EQUIPMENT
    quantity: int = Field(1, ge=1)
    capacity: Optional[int] = None
    deposit_amount: float = Field(0.00, ge=0)
    approval_required: bool = False
    training_required: bool = False
    is_restricted: bool = False
    min_booking_minutes: int = Field(30, ge=15)
    max_booking_minutes: int = Field(240, ge=15)
    slot_minutes: int = Field(30, ge=15)
    advance_booking_days: int = Field(14, ge=1)
    specifications: Optional[Dict[str, Any]] = None

class ResourceUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None
    quantity: Optional[int] = Field(None, ge=1)
    capacity: Optional[int] = None
    deposit_amount: Optional[float] = Field(None, ge=0)
    approval_required: Optional[bool] = None
    training_required: Optional[bool] = None
    is_restricted: Optional[bool] = None
    status: Optional[ResourceStatus] = None
    min_booking_minutes: Optional[int] = None
    max_booking_minutes: Optional[int] = None
    slot_minutes: Optional[int] = None
    advance_booking_days: Optional[int] = None
    specifications: Optional[Dict[str, Any]] = None

class ResourceResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str]
    category_id: uuid.UUID
    category_name: Optional[str] = None
    department_id: uuid.UUID
    department_code: Optional[str] = None
    owner_id: uuid.UUID
    owner_name: Optional[str] = None
    location: str
    resource_type: ResourceType
    quantity: int
    available_quantity: Optional[int] = None
    capacity: Optional[int]
    status: ResourceStatus
    deposit_amount: float
    approval_required: bool
    training_required: bool
    is_restricted: bool
    min_booking_minutes: int
    max_booking_minutes: int
    slot_minutes: int
    advance_booking_days: int
    popularity_count: int
    primary_image_url: Optional[str] = None
    specifications: Dict[str, Any]
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class ResourceDetailResponse(ResourceResponse):
    images: List[ResourceImageSchema] = []
    units: List[ResourceUnitSchema] = []
    rule: Optional[ResourceRuleSchema] = None
    availabilities: List[ResourceAvailabilitySchema] = []
    blackouts: List[ResourceBlackoutSchema] = []
    similar_resources: List[ResourceResponse] = []
    usage_summary: Dict[str, Any] = {}

class EligibilityCheckItem(BaseModel):
    name: str
    passed: bool
    message: str

class EligibilityResponse(BaseModel):
    resource_id: uuid.UUID
    eligible: bool
    checks: List[EligibilityCheckItem]

class FreeSlotItem(BaseModel):
    start_time: str # "10:00"
    end_time: str   # "11:30"
    available_units: int
    total_units: int
    available: bool

class DateAvailabilityResponse(BaseModel):
    resource_id: uuid.UUID
    date: str
    slots: List[FreeSlotItem]

class DayAvailability(BaseModel):
    date: str
    status: str # "free", "partial", "full", "closed"
    free_slots_count: int

class CalendarAvailabilityResponse(BaseModel):
    resource_id: uuid.UUID
    days: List[DayAvailability]
