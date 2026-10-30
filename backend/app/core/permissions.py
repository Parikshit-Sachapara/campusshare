from typing import List, Dict, Set
from sqlalchemy.orm import Session
from ..models import PlatformSetting, UserRole

DEFAULT_PERMISSIONS: Dict[str, Set[str]] = {
    "view_resources": {"STUDENT", "OWNER", "MANAGER", "ADMIN"},
    "request_booking": {"STUDENT", "ADMIN"},
    "add_resource": {"OWNER", "MANAGER", "ADMIN"},
    "manage_resource": {"OWNER", "MANAGER", "ADMIN"},
    "approve_booking": {"OWNER", "MANAGER", "ADMIN"},
    "checkout_handover": {"OWNER", "MANAGER", "ADMIN"},
    "submit_return": {"STUDENT"},
    "verify_return": {"OWNER", "MANAGER", "ADMIN"},
    "resolve_incident": {"MANAGER", "ADMIN"},
    "manage_users": {"ADMIN"},
    "view_audit_trail": {"MANAGER", "ADMIN"},
}

def get_effective_permissions(db: Session) -> Dict[str, Set[str]]:
    """
    Returns effective permissions, merging code defaults with any admin overrides
    stored in platform_settings with key 'permissions'.
    """
    setting = db.query(PlatformSetting).filter_by(key="permissions").first()
    if not setting or not isinstance(setting.value, dict):
        return DEFAULT_PERMISSIONS

    effective = {}
    for perm, default_roles in DEFAULT_PERMISSIONS.items():
        if perm in setting.value and isinstance(setting.value[perm], list):
            effective[perm] = set(setting.value[perm])
        else:
            effective[perm] = set(default_roles)
    return effective

def is_role_permitted(action: str, role: str, db: Session) -> bool:
    perms = get_effective_permissions(db)
    allowed_roles = perms.get(action, set())
    return str(role).upper() in allowed_roles
