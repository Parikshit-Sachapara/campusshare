import uuid
from typing import Generator, List, Optional
from fastapi import Depends, HTTPException, status, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Profile, UserRole, Booking, Resource
from .security import decode_token
from .permissions import is_role_permitted
from .exceptions import CampusShareException

security_bearer = HTTPBearer(auto_error=False)

def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer),
    db: Session = Depends(get_db),
) -> Profile:
    """
    Validates JWT token on every authenticated request and strictly checks:
    1. Valid token signature and expiration
    2. User exists in database
    3. User is active (not suspended or deactivated)
    """
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "UNAUTHORIZED", "message": "Authentication token missing.", "details": {}},
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "INVALID_TOKEN", "message": "Access token is invalid or expired.", "details": {}},
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id_str = payload.get("sub")
    if not user_id_str:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "INVALID_TOKEN", "message": "Malformed token subject.", "details": {}},
        )

    try:
        user_uuid = uuid.UUID(user_id_str)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "INVALID_TOKEN", "message": "Invalid user ID format in token.", "details": {}},
        )

    user = db.query(Profile).filter_by(id=user_uuid).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "USER_NOT_FOUND", "message": "User account no longer exists.", "details": {}},
        )

    # BLOCK SUSPENDED OR INACTIVE USERS ON EVERY REQUEST
    if not user.is_active:
        raise CampusShareException(
            code="ACCOUNT_SUSPENDED",
            message=f"Account is suspended: {user.suspended_reason or 'Contact campus administrator'}",
            status_code=status.HTTP_403_FORBIDDEN,
            details={"no_show_count": user.no_show_count},
        )

    return user


def get_current_active_user(
    current_user: Profile = Depends(get_current_user),
) -> Profile:
    return current_user


def require_roles(*allowed_roles):
    """
    FastAPI dependency enforcing RBAC permissions in the backend.
    """
    flattened = []
    for r in allowed_roles:
        if isinstance(r, (list, tuple, set)):
            flattened.extend(r)
        else:
            flattened.append(r)
    allowed_role_strs = {str(r.value if hasattr(r, "value") else r).upper() for r in flattened}

    def role_checker(current_user: Profile = Depends(get_current_user)) -> Profile:
        user_role_str = str(current_user.role.value if hasattr(current_user.role, "value") else current_user.role).upper()
        if user_role_str not in allowed_role_strs:
            raise CampusShareException(
                code="FORBIDDEN_ROLE",
                message=f"Access denied for role '{user_role_str}'. Required one of: {list(allowed_role_strs)}",
                status_code=status.HTTP_403_FORBIDDEN,
                details={"user_role": user_role_str, "required_roles": list(allowed_role_strs)},
            )
        return current_user

    return role_checker

require_role = require_roles


# -------------------------------------------------------------
# Object-Level Authorization Helpers
# -------------------------------------------------------------
def check_booking_ownership_or_manager(
    booking: Booking,
    user: Profile,
    allow_owner_view: bool = True,
) -> None:
    """
    Enforces object-level security:
    - Students can ONLY access their own bookings.
    - Owners can only view bookings for resources they own.
    - Managers can view bookings within their department or if admin.
    Raises 403 Forbidden if unauthorized (prevents horizontal privilege escalation).
    """
    if user.role == UserRole.ADMIN:
        return

    # Student viewing
    if user.role == UserRole.STUDENT:
        if booking.student_id != user.id:
            raise CampusShareException(
                code="HORIZONTAL_PRIVILEGE_VIOLATION",
                message="You do not have permission to view or modify this booking.",
                status_code=status.HTTP_403_FORBIDDEN,
                details={"booking_id": str(booking.id)},
            )
        return

    # Owner viewing
    if user.role == UserRole.OWNER and allow_owner_view:
        if booking.resource.owner_id != user.id:
            raise CampusShareException(
                code="OBJECT_ACCESS_DENIED",
                message="Owners can only access bookings for resources they own.",
                status_code=status.HTTP_403_FORBIDDEN,
                details={"booking_id": str(booking.id)},
            )
        return

    # Manager viewing
    if user.role == UserRole.MANAGER:
        # Managers can approve/inspect resources in their department or general platform resources
        if booking.resource.department_id and user.department_id:
            if booking.resource.department_id != user.department_id and not booking.resource.is_restricted:
                # If resource is in a different department and not cross-departmental, reject
                raise CampusShareException(
                    code="DEPARTMENT_MISMATCH",
                    message="Managers can only oversee bookings for their own academic department.",
                    status_code=status.HTTP_403_FORBIDDEN,
                    details={"booking_dept": str(booking.resource.department_id), "manager_dept": str(user.department_id)},
                )
        return


def check_resource_management_rights(resource: Resource, user: Profile) -> None:
    """
    Enforces that only the assigned owner or an administrator can update/archive a resource.
    """
    if user.role == UserRole.ADMIN:
        return

    if user.role == UserRole.OWNER:
        if resource.owner_id != user.id:
            raise CampusShareException(
                code="RESOURCE_OWNER_MISMATCH",
                message="You can only manage resources assigned to your laboratory ownership.",
                status_code=status.HTTP_403_FORBIDDEN,
                details={"resource_id": str(resource.id)},
            )
        return

    if user.role == UserRole.MANAGER:
        if resource.department_id != user.department_id:
            raise CampusShareException(
                code="RESOURCE_DEPARTMENT_MISMATCH",
                message="Managers can only manage resources within their department.",
                status_code=status.HTTP_403_FORBIDDEN,
                details={"resource_id": str(resource.id)},
            )
        return

    raise CampusShareException(
        code="UNAUTHORIZED_MANAGEMENT",
        message="You do not have management permissions on this resource.",
        status_code=status.HTTP_403_FORBIDDEN,
    )
