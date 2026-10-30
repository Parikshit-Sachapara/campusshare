import uuid
from typing import Optional, Union, Any
from pydantic import BaseModel, EmailStr, Field, ConfigDict, AliasChoices, model_validator
from ..models.enums import UserRole

class RegisterRequest(BaseModel):
    email: EmailStr = Field(..., examples=["riya.sharma@campusshare.demo"])
    password: str = Field(..., min_length=6, description="Password min 6 chars", examples=["Password123!"])
    full_name: str = Field(..., min_length=2, max_length=150, examples=["Riya Sharma"])
    role: Optional[UserRole] = Field(default=UserRole.STUDENT, description="User role (STUDENT, OWNER, MANAGER, ADMIN)")
    # Accepts either department_id or dept_id cleanly
    department_id: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("department_id", "dept_id"),
        description="Department code (e.g. CS, EC, ME, MD, PH) or Department UUID",
        examples=["CS"]
    )
    student_id: Optional[str] = Field(default=None, description="Student Enrollment / Roll No (e.g. STU-2026-099)", examples=["STU-2026-099"])
    phone: Optional[str] = Field(default=None, examples=["+91 98765 43210"])

    model_config = ConfigDict(extra="ignore")

    @model_validator(mode="before")
    @classmethod
    def normalize_dept_id(cls, data: Any) -> Any:
        if isinstance(data, dict):
            # If someone submits dept_id instead of department_id, map it cleanly
            val = data.get("department_id") if data.get("department_id") is not None else data.get("dept_id")
            if val is not None:
                val_str = str(val).strip()
                data["department_id"] = val_str if val_str else None
        return data

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class ProfileResponse(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    role: UserRole
    # Single department field
    department_id: Optional[str] = None
    student_id: Optional[str] = None
    avatar_url: Optional[str] = None
    phone: Optional[str] = None
    is_active: bool
    is_verified: bool
    no_show_count: int
    standing_score: int = 100

    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode="before")
    @classmethod
    def serialize_dept_id(cls, data: Any) -> Any:
        if hasattr(data, "department_id"):
            raw_dept = getattr(data, "department_id", None)
            dept_str = str(raw_dept) if raw_dept is not None else None
            return {
                "id": getattr(data, "id"),
                "email": getattr(data, "email"),
                "full_name": getattr(data, "full_name"),
                "role": getattr(data, "role"),
                "department_id": dept_str,
                "student_id": getattr(data, "student_id", None),
                "avatar_url": getattr(data, "avatar_url", None),
                "phone": getattr(data, "phone", None),
                "is_active": getattr(data, "is_active", True),
                "is_verified": getattr(data, "is_verified", True),
                "no_show_count": getattr(data, "no_show_count", 0),
                "standing_score": 100,
            }
        elif isinstance(data, dict):
            raw_dept = data.get("department_id") if data.get("department_id") is not None else data.get("dept_id")
            data["department_id"] = str(raw_dept) if raw_dept is not None else None
        return data

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: Optional[str] = Field(None, description="7-day refresh token string (also set in httpOnly cookie)")
    token_type: str = "bearer"
    expires_in: int
    user: ProfileResponse

class RefreshTokenRequest(BaseModel):
    refresh_token: Optional[str] = Field(
        default=None, 
        description="Paste refresh_token string from POST /auth/login response (or leave empty if testing in browser with cookies)",
        examples=["eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."]
    )

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=6)

class ProfileUpdateRequest(BaseModel):
    full_name: Optional[str] = Field(None, min_length=2, max_length=150)
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    department_id: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("department_id", "dept_id"),
        description="Department code (e.g. CS, EC, ME, MD, PH) or Department UUID",
        examples=["CS"]
    )

    @model_validator(mode="before")
    @classmethod
    def normalize_dept_id(cls, data: Any) -> Any:
        if isinstance(data, dict):
            val = data.get("department_id") if data.get("department_id") is not None else data.get("dept_id")
            if val is not None:
                val_str = str(val).strip()
                data["department_id"] = val_str if val_str else None
        return data
