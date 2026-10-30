import uuid
from typing import Optional, Dict, Any, Tuple
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from fastapi import status

from sqlalchemy import or_
from ..models import Profile, UserRole, Department
from ..schemas.auth import RegisterRequest, LoginRequest, ProfileUpdateRequest
from ..core.security import verify_password, get_password_hash, create_access_token, create_refresh_token, decode_token
from ..core.audit import audit
from ..core.exceptions import CampusShareException

class AuthService:
    @staticmethod
    def resolve_department_id(db: Session, dept_input: Any) -> Optional[uuid.UUID]:
        if not dept_input:
            return None
        dept_str = str(dept_input).strip()
        if not dept_str or dept_str.lower() in ("null", "none"):
            return None

        # 1. Try parsing as UUID
        try:
            parsed_uuid = uuid.UUID(dept_str)
            dept = db.query(Department).filter_by(id=parsed_uuid).first()
            if dept:
                return dept.id
        except ValueError:
            pass

        # 2. Try looking up by code (e.g. 'CS', 'ECE') or name (e.g. 'Computer Science')
        dept = db.query(Department).filter(
            or_(
                Department.code.ilike(dept_str),
                Department.name.ilike(dept_str)
            )
        ).first()
        if dept:
            return dept.id

        # 3. If dept_str is placeholder like "string" or not found, fallback to first available department
        first_dept = db.query(Department).first()
        if first_dept:
            return first_dept.id

        return None

    @staticmethod
    def register(db: Session, data: RegisterRequest, client_ip: Optional[str] = None) -> Profile:
        # Check existing email
        existing = db.query(Profile).filter_by(email=data.email.lower().strip()).first()
        if existing:
            raise CampusShareException(
                code="EMAIL_ALREADY_REGISTERED",
                message="An account with this institutional email already exists.",
                status_code=status.HTTP_409_CONFLICT,
            )

        # Enforce registration rules
        role = data.role or UserRole.STUDENT
        # Students self-register; Owners register as pending admin verification
        if role == UserRole.OWNER:
            is_verified = False # Needs admin verification
        else:
            role = UserRole.STUDENT # Forced to STUDENT for self-registration
            is_verified = True

        hashed = get_password_hash(data.password)

        resolved_dept_id = AuthService.resolve_department_id(db, data.department_id)

        new_profile = Profile(
            email=data.email.lower().strip(),
            password_hash=hashed,
            full_name=data.full_name.strip(),
            role=role,
            department_id=resolved_dept_id,
            student_id=data.student_id,
            phone=data.phone,
            is_active=True,
            is_verified=is_verified,
            avatar_url=f"https://api.dicebear.com/7.x/bottts/svg?seed={data.email}",
        )
        db.add(new_profile)
        db.flush()

        # Write to append-only audit trail
        audit(
            db=db,
            actor_id=new_profile.id,
            actor_role=str(new_profile.role),
            action="USER_REGISTERED",
            entity_type="Profile",
            entity_id=str(new_profile.id),
            metadata={"role": str(role), "is_verified": is_verified},
            ip=client_ip,
        )

        db.commit()
        db.refresh(new_profile)

        # Dev Mode Banner in logs for email verification
        verification_token = create_access_token({"sub": str(new_profile.id), "purpose": "email_verify"}, expires_delta=timedelta(days=1))
        print("=" * 65)
        print(f"[DEV MODE] Email Verification Link for {new_profile.email}:")
        print(f"http://localhost:5173/verify?token={verification_token}")
        print("=" * 65)

        return new_profile

    @staticmethod
    def login(db: Session, data: LoginRequest, client_ip: Optional[str] = None) -> Tuple[str, str, Profile]:
        user = db.query(Profile).filter_by(email=data.email.lower().strip()).first()
        if not user or not verify_password(data.password, user.password_hash):
            raise CampusShareException(
                code="INVALID_CREDENTIALS",
                message="Invalid email address or password.",
                status_code=status.HTTP_401_UNAUTHORIZED,
            )

        # Block suspended or inactive users at login
        if not user.is_active:
            raise CampusShareException(
                code="ACCOUNT_SUSPENDED",
                message=f"Account is suspended: {user.suspended_reason or 'Contact campus administrator'}",
                status_code=status.HTTP_403_FORBIDDEN,
            )

        access_token = create_access_token({"sub": str(user.id), "role": str(user.role), "email": user.email})
        refresh_token = create_refresh_token({"sub": str(user.id), "role": str(user.role)})

        # Audit login success
        audit(
            db=db,
            actor_id=user.id,
            actor_role=str(user.role),
            action="LOGIN_SUCCESS",
            entity_type="Profile",
            entity_id=str(user.id),
            metadata={"email": user.email},
            ip=client_ip,
        )
        db.commit()

        return access_token, refresh_token, user

    @staticmethod
    def refresh_access_token(db: Session, token: str) -> Tuple[str, Profile]:
        payload = decode_token(token)
        if not payload or payload.get("type") != "refresh":
            raise CampusShareException(
                code="INVALID_REFRESH_TOKEN",
                message="Refresh token is invalid or expired.",
                status_code=status.HTTP_401_UNAUTHORIZED,
            )

        user_id_str = payload.get("sub")
        try:
            user_uuid = uuid.UUID(user_id_str)
        except (ValueError, TypeError):
            raise CampusShareException(code="INVALID_TOKEN", message="Malformed token.", status_code=status.HTTP_401_UNAUTHORIZED)

        user = db.query(Profile).filter_by(id=user_uuid).first()
        if not user or not user.is_active:
            raise CampusShareException(code="ACCOUNT_INACTIVE", message="Account inactive or not found.", status_code=status.HTTP_403_FORBIDDEN)

        new_access_token = create_access_token({"sub": str(user.id), "role": str(user.role), "email": user.email})
        return new_access_token, user

    @staticmethod
    def forgot_password(db: Session, email: str, client_ip: Optional[str] = None) -> None:
        user = db.query(Profile).filter_by(email=email.lower().strip()).first()
        if user and user.is_active:
            reset_token = create_access_token({"sub": str(user.id), "purpose": "password_reset"}, expires_delta=timedelta(hours=2))
            print("=" * 65)
            print(f"[DEV MODE] Password Reset Link for {user.email}:")
            print(f"http://localhost:5173/reset-password?token={reset_token}")
            print("=" * 65)
            audit(
                db=db,
                actor_id=user.id,
                actor_role=str(user.role),
                action="PASSWORD_RESET_REQUESTED",
                entity_type="Profile",
                entity_id=str(user.id),
                ip=client_ip,
            )
            db.commit()

    @staticmethod
    def reset_password(db: Session, token: str, new_password: str, client_ip: Optional[str] = None) -> None:
        payload = decode_token(token)
        if not payload or payload.get("purpose") != "password_reset":
            raise CampusShareException(
                code="INVALID_RESET_TOKEN",
                message="Password reset token is invalid or expired.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        user_id = uuid.UUID(payload["sub"])
        user = db.query(Profile).filter_by(id=user_id).first()
        if not user or not user.is_active:
            raise CampusShareException(code="USER_NOT_FOUND", message="User not found or inactive.", status_code=status.HTTP_404_NOT_FOUND)

        user.password_hash = get_password_hash(new_password)
        audit(
            db=db,
            actor_id=user.id,
            actor_role=str(user.role),
            action="PASSWORD_RESET_SUCCESS",
            entity_type="Profile",
            entity_id=str(user.id),
            ip=client_ip,
        )
        db.commit()

    @staticmethod
    def update_profile(db: Session, user: Profile, update_data: ProfileUpdateRequest, client_ip: Optional[str] = None) -> Profile:
        if update_data.full_name is not None:
            user.full_name = update_data.full_name.strip()
        if update_data.phone is not None:
            user.phone = update_data.phone.strip()
        if update_data.avatar_url is not None:
            user.avatar_url = update_data.avatar_url.strip()
        if update_data.department_id is not None:
            user.department_id = AuthService.resolve_department_id(db, update_data.department_id)

        audit(
            db=db,
            actor_id=user.id,
            actor_role=str(user.role),
            action="PROFILE_UPDATED",
            entity_type="Profile",
            entity_id=str(user.id),
            ip=client_ip,
        )
        db.commit()
        db.refresh(user)
        return user
