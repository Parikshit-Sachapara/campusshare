import uuid
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Profile, PlatformSetting, UsageLimit
from ..models.enums import UserRole
from ..schemas.fairness import (
    FairnessProfileResponse,
    PriorityWeightsUpdate,
    UsageLimitCreate,
    UsageLimitUpdate,
    UsageLimitResponse,
)
from ..schemas.common import SuccessResponse
from ..core.deps import get_current_user, require_roles
from ..core.exceptions import CampusShareException
from ..core.audit import audit
from ..services.fairness_service import FairnessService

router = APIRouter(tags=["Fairness & Institutional Governance"])

@router.get("/fairness/me", response_model=FairnessProfileResponse)
def get_my_fairness_profile(
    user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns the student's algorithmic usage standing, no-shows, limits, and formula explanation.
    """
    return FairnessService.get_user_fairness_profile(db=db, user=user)

@router.get("/admin/fairness/weights", response_model=Dict[str, float])
def get_priority_weights(
    user: Profile = Depends(require_roles(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    """
    Administrator endpoint: retrieves active algorithmic priority weights.
    """
    return FairnessService.get_weights(db)

@router.put("/admin/fairness/weights", response_model=Dict[str, float])
def update_priority_weights(
    body: PriorityWeightsUpdate,
    request: Request,
    user: Profile = Depends(require_roles(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    """
    Administrator endpoint: updates priority weights. Sum must strictly equal 100.
    """
    total = round(body.wN + body.wD + body.wE + body.wA, 2)
    if total != 100.0:
        raise CampusShareException(
            code="INVALID_WEIGHTS_SUM",
            message=f"Weights must sum to exactly 100%. Provided total: {total}%.",
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        )

    weights_dict = {
        "wN": body.wN,
        "wD": body.wD,
        "wE": body.wE,
        "wA": body.wA,
    }

    setting = db.query(PlatformSetting).filter_by(key="priority_weights").first()
    if not setting:
        setting = PlatformSetting(key="priority_weights", value=weights_dict)
        db.add(setting)
    else:
        setting.value = weights_dict

    client_ip = request.client.host if request.client else None
    audit(
        db=db,
        actor_id=user.id,
        actor_role="ADMIN",
        action="PRIORITY_WEIGHTS_UPDATED",
        entity_type="PlatformSetting",
        entity_id="priority_weights",
        metadata={"weights": weights_dict},
        ip=client_ip,
    )

    db.commit()
    return weights_dict

@router.get("/admin/usage-limits", response_model=List[UsageLimitResponse])
def list_usage_limits(
    user: Profile = Depends(require_roles(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    """
    Administrator endpoint: lists all configured global, category, and resource usage limits.
    """
    return db.query(UsageLimit).order_by(UsageLimit.scope).all()

@router.post("/admin/usage-limits", response_model=UsageLimitResponse, status_code=status.HTTP_201_CREATED)
def create_usage_limit(
    body: UsageLimitCreate,
    request: Request,
    user: Profile = Depends(require_roles(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    """
    Administrator endpoint: creates a scoped usage limit policy.
    """
    limit = UsageLimit(
        scope=body.scope,
        scope_id=body.scope_id,
        max_active_bookings=body.max_active_bookings,
        max_bookings_per_week=body.max_bookings_per_week,
        max_hours_per_week=body.max_hours_per_week,
        no_show_threshold=body.no_show_threshold,
        no_show_cooldown_days=body.no_show_cooldown_days,
        created_by=user.id,
    )
    db.add(limit)
    db.flush()

    client_ip = request.client.host if request.client else None
    audit(
        db=db,
        actor_id=user.id,
        actor_role="ADMIN",
        action="USAGE_LIMIT_CREATED",
        entity_type="UsageLimit",
        entity_id=str(limit.id),
        metadata={"scope": body.scope.value, "scope_id": str(body.scope_id) if body.scope_id else None},
        ip=client_ip,
    )

    db.commit()
    db.refresh(limit)
    return limit

@router.put("/admin/usage-limits/{id}", response_model=UsageLimitResponse)
def update_usage_limit(
    id: uuid.UUID,
    body: UsageLimitUpdate,
    request: Request,
    user: Profile = Depends(require_roles(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    limit = db.query(UsageLimit).filter_by(id=id).first()
    if not limit:
        raise CampusShareException(code="LIMIT_NOT_FOUND", message="Usage limit not found.", status_code=404)

    if body.max_active_bookings is not None:
        limit.max_active_bookings = body.max_active_bookings
    if body.max_bookings_per_week is not None:
        limit.max_bookings_per_week = body.max_bookings_per_week
    if body.max_hours_per_week is not None:
        limit.max_hours_per_week = body.max_hours_per_week
    if body.no_show_threshold is not None:
        limit.no_show_threshold = body.no_show_threshold
    if body.no_show_cooldown_days is not None:
        limit.no_show_cooldown_days = body.no_show_cooldown_days

    client_ip = request.client.host if request.client else None
    audit(
        db=db,
        actor_id=user.id,
        actor_role="ADMIN",
        action="USAGE_LIMIT_UPDATED",
        entity_type="UsageLimit",
        entity_id=str(limit.id),
        metadata=body.model_dump(exclude_unset=True),
        ip=client_ip,
    )

    db.commit()
    db.refresh(limit)
    return limit

