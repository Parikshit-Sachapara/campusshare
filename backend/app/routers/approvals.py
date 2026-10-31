import uuid
from typing import List
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Profile
from ..models.enums import UserRole
from ..schemas.booking import BookingResponse
from ..schemas.approval import (
    ApprovalQueueItem,
    ApprovalRejectRequest,
    ApprovalRequestInfoRequest,
    ApprovalAlternativeRequest,
    ApprovalEscalateRequest,
)
from ..core.deps import get_current_user, require_roles
from ..services.approval_service import ApprovalService

router = APIRouter(tags=["Approvals & Triage"])

@router.get("/approvals/queue", response_model=List[ApprovalQueueItem])
def get_approval_queue(
    user: Profile = Depends(require_roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    """
    Returns the pending approval queue scoped to the approver's role and department.
    Sorted by priority score descending.
    """
    return ApprovalService.get_approval_queue(db=db, user=user)

@router.post("/bookings/{id}/approve", response_model=BookingResponse)
@router.post("/approvals/{id}/approve", response_model=BookingResponse)
def approve_booking(
    id: uuid.UUID,
    request: Request,
    user: Profile = Depends(require_roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    """
    Approves a pending booking, validates physical overlap, assigns unit, and notifies student.
    """
    client_ip = request.client.host if request.client else None
    approved = ApprovalService.approve_booking(db=db, booking_id=id, user=user, client_ip=client_ip)
    return BookingResponse.model_validate(approved)

@router.post("/bookings/{id}/reject", response_model=BookingResponse)
@router.post("/approvals/{id}/reject", response_model=BookingResponse)
def reject_booking(
    id: uuid.UUID,
    body: ApprovalRejectRequest,
    request: Request,
    user: Profile = Depends(require_roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    """
    Declines a booking request with mandatory reason and notifies student.
    """
    client_ip = request.client.host if request.client else None
    rejected = ApprovalService.reject_booking(
        db=db, booking_id=id, user=user, reason=body.reason, client_ip=client_ip
    )
    return BookingResponse.model_validate(rejected)

@router.post("/bookings/{id}/request-info", response_model=BookingResponse)
def request_info(
    id: uuid.UUID,
    body: ApprovalRequestInfoRequest,
    request: Request,
    user: Profile = Depends(require_roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    """
    Requests additional details or documentation from the applicant student.
    """
    client_ip = request.client.host if request.client else None
    updated = ApprovalService.request_info(
        db=db, booking_id=id, user=user, message=body.message, client_ip=client_ip
    )
    return BookingResponse.model_validate(updated)

@router.post("/bookings/{id}/suggest-alternative", response_model=BookingResponse)
def suggest_alternative(
    id: uuid.UUID,
    body: ApprovalAlternativeRequest,
    request: Request,
    user: Profile = Depends(require_roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    """
    Proposes an alternative time slot to the applicant student.
    """
    client_ip = request.client.host if request.client else None
    updated = ApprovalService.suggest_alternative(
        db=db,
        booking_id=id,
        user=user,
        alternative_start_ts=body.alternative_start_ts,
        alternative_end_ts=body.alternative_end_ts,
        note=body.note,
        client_ip=client_ip,
    )
    return BookingResponse.model_validate(updated)

@router.post("/bookings/{id}/waitlist", response_model=BookingResponse)
def waitlist_booking(
    id: uuid.UUID,
    request: Request,
    user: Profile = Depends(require_roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    """
    Moves a pending booking into waitlisted state.
    """
    client_ip = request.client.host if request.client else None
    updated = ApprovalService.waitlist_booking(db=db, booking_id=id, user=user, client_ip=client_ip)
    return BookingResponse.model_validate(updated)

@router.post("/bookings/{id}/escalate", response_model=BookingResponse)
def escalate_booking(
    id: uuid.UUID,
    body: ApprovalEscalateRequest,
    request: Request,
    user: Profile = Depends(require_roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    """
    Escalates a booking approval to Facility Managers or Institutional Admins.
    """
    client_ip = request.client.host if request.client else None
    updated = ApprovalService.escalate_booking(
        db=db,
        booking_id=id,
        user=user,
        note=body.note,
        target_role=body.target_role or UserRole.MANAGER,
        client_ip=client_ip,
    )
    return BookingResponse.model_validate(updated)

