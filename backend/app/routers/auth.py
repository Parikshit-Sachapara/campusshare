from fastapi import APIRouter, Depends, Request, Response, status, Cookie
from typing import Optional
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Profile
from ..schemas.auth import (
    RegisterRequest,
    LoginRequest,
    TokenResponse,
    RefreshTokenRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    ProfileResponse,
    ProfileUpdateRequest,
)
from ..schemas.common import SuccessResponse
from ..services.auth_service import AuthService
from ..core.deps import get_current_user
from ..core.rate_limit import login_rate_limiter
from ..config import settings

router = APIRouter(prefix="/auth", tags=["Authentication & User Identity"])

@router.post("/register", response_model=ProfileResponse, status_code=status.HTTP_201_CREATED)
def register(req: RegisterRequest, request: Request, db: Session = Depends(get_db)):
    client_ip = request.client.host if request.client else None
    user = AuthService.register(db=db, data=req, client_ip=client_ip)
    return user

@router.post("/login", response_model=TokenResponse)
def login(
    req: LoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    client_ip = request.client.host if request.client else "unknown"
    # Rate limit check: 5 attempts per minute per IP
    login_rate_limiter.check_rate_limit(client_ip)

    access_token, refresh_token, user = AuthService.login(db=db, data=req, client_ip=client_ip)

    # Set httpOnly cookie for refresh token
    response.set_cookie(
        key="campusshare_refresh",
        value=refresh_token,
        httponly=True,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600,
        samesite="lax",
        secure=False, # Set True in HTTPS production
    )

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=user,
    )

@router.post("/refresh", response_model=TokenResponse)
def refresh_token(
    request: Request,
    body: Optional[RefreshTokenRequest] = None,
    campusshare_refresh: Optional[str] = Cookie(None),
    db: Session = Depends(get_db),
):
    # Prefer cookie, fallback to request body
    token = campusshare_refresh or (body.refresh_token if body else None)
    if not token:
        from ..core.exceptions import CampusShareException
        raise CampusShareException(
            code="REFRESH_TOKEN_MISSING",
            message="No refresh token provided in cookie or request body.",
            status_code=status.HTTP_401_UNAUTHORIZED,
        )

    new_access_token, user = AuthService.refresh_access_token(db=db, token=token)
    return TokenResponse(
        access_token=new_access_token,
        refresh_token=token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=user,
    )

@router.post("/logout", response_model=SuccessResponse)
def logout(response: Response):
    response.delete_cookie(key="campusshare_refresh")
    return SuccessResponse(message="Successfully logged out.")

@router.post("/forgot-password", response_model=SuccessResponse)
def forgot_password(req: ForgotPasswordRequest, request: Request, db: Session = Depends(get_db)):
    client_ip = request.client.host if request.client else None
    AuthService.forgot_password(db=db, email=req.email, client_ip=client_ip)
    return SuccessResponse(message="If an active account exists with that email, a password reset link has been dispatched.")

@router.post("/reset-password", response_model=SuccessResponse)
def reset_password(req: ResetPasswordRequest, request: Request, db: Session = Depends(get_db)):
    client_ip = request.client.host if request.client else None
    AuthService.reset_password(db=db, token=req.token, new_password=req.new_password, client_ip=client_ip)
    return SuccessResponse(message="Password reset successfully. You may now log in with your new password.")

# Self Profile Endpoints (/me)
@router.get("/me", response_model=ProfileResponse, tags=["Current User Profile"])
def get_current_user_profile(user: Profile = Depends(get_current_user)):
    return user

@router.patch("/me", response_model=ProfileResponse, tags=["Current User Profile"])
def update_current_user_profile(
    req: ProfileUpdateRequest,
    request: Request,
    user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    client_ip = request.client.host if request.client else None
    updated = AuthService.update_profile(db=db, user=user, update_data=req, client_ip=client_ip)
    return updated

# ===================================================================
# Admin User Management Endpoints
# ===================================================================
from ..core.deps import require_role
from ..core.audit import audit
from ..core.exceptions import CampusShareException
from ..models.enums import UserRole
from pydantic import BaseModel
import uuid

class RoleUpdateRequest(BaseModel):
    role: UserRole

class UserStatusUpdateRequest(BaseModel):
    is_active: bool
    reason: str

@router.get("/users", tags=["Admin User Management"])
def list_users_admin(
    search: Optional[str] = None,
    role: Optional[UserRole] = None,
    department_id: Optional[uuid.UUID] = None,
    is_verified: Optional[bool] = None,
    page: int = 1,
    size: int = 50,
    db: Session = Depends(get_db),
    admin: Profile = Depends(require_role([UserRole.ADMIN])),
):
    query = db.query(Profile)
    if role:
        query = query.filter(Profile.role == role)
    if department_id:
        query = query.filter(Profile.department_id == department_id)
    if is_verified is not None:
        query = query.filter(Profile.is_verified == is_verified)
    if search:
        s = f"%{search}%"
        query = query.filter((Profile.full_name.ilike(s)) | (Profile.email.ilike(s)) | (Profile.student_id.ilike(s)))
    
    total = query.count()
    users = query.order_by(Profile.created_at.desc()).offset((page - 1) * size).limit(size).all()
    
    return {
        "items": [
            {
                "id": str(u.id),
                "email": u.email,
                "full_name": u.full_name,
                "role": u.role.value if hasattr(u.role, "value") else u.role,
                "department_id": str(u.department_id) if u.department_id else None,
                "dept_id": u.dept_id or (u.department.code if u.department else None),
                "student_id": u.student_id,
                "phone": u.phone,
                "is_active": u.is_active,
                "is_verified": u.is_verified,
                "no_show_count": u.no_show_count or 0,
                "created_at": u.created_at.isoformat() if u.created_at else None,
            }
            for u in users
        ],
        "total": total,
        "page": page,
        "size": size,
    }

@router.patch("/users/{user_id}/role", tags=["Admin User Management"])
def update_user_role(
    user_id: uuid.UUID,
    data: RoleUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    admin: Profile = Depends(require_role([UserRole.ADMIN])),
):
    target_user = db.query(Profile).filter_by(id=user_id).first()
    if not target_user:
        raise CampusShareException(code="USER_NOT_FOUND", message="User not found.", status_code=404)
    old_role = target_user.role.value if hasattr(target_user.role, "value") else target_user.role
    target_user.role = data.role
    db.commit()
    audit(
        db=db,
        actor_id=admin.id,
        actor_role="ADMIN",
        action="USER_ROLE_CHANGED",
        entity_type="Profile",
        entity_id=str(target_user.id),
        metadata={"old_role": old_role, "new_role": data.role.value},
        ip=request.client.host if request.client else None,
    )
    return {"message": f"Role updated to {data.role.value}", "role": data.role.value}

@router.patch("/users/{user_id}/verify", tags=["Admin User Management"])
def verify_user_account(
    user_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    admin: Profile = Depends(require_role([UserRole.ADMIN])),
):
    target_user = db.query(Profile).filter_by(id=user_id).first()
    if not target_user:
        raise CampusShareException(code="USER_NOT_FOUND", message="User not found.", status_code=404)
    target_user.is_verified = True
    db.commit()
    audit(
        db=db,
        actor_id=admin.id,
        actor_role="ADMIN",
        action="USER_VERIFIED",
        entity_type="Profile",
        entity_id=str(target_user.id),
        metadata={"email": target_user.email},
        ip=request.client.host if request.client else None,
    )
    return {"message": "Account successfully verified.", "is_verified": True}

@router.patch("/users/{user_id}/status", tags=["Admin User Management"])
def update_user_status(
    user_id: uuid.UUID,
    data: UserStatusUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    admin: Profile = Depends(require_role([UserRole.ADMIN])),
):
    if not data.reason or not data.reason.strip():
        raise CampusShareException(code="REASON_REQUIRED", message="A mandatory reason is required to alter user standing.", status_code=422)
    target_user = db.query(Profile).filter_by(id=user_id).first()
    if not target_user:
        raise CampusShareException(code="USER_NOT_FOUND", message="User not found.", status_code=404)
    target_user.is_active = data.is_active
    db.commit()
    audit(
        db=db,
        actor_id=admin.id,
        actor_role="ADMIN",
        action="USER_SUSPENDED" if not data.is_active else "USER_REACTIVATED",
        entity_type="Profile",
        entity_id=str(target_user.id),
        metadata={"is_active": data.is_active, "reason": data.reason},
        ip=request.client.host if request.client else None,
    )
    return {"message": f"User status set to {'active' if data.is_active else 'suspended'}.", "is_active": data.is_active}

