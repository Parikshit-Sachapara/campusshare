import uuid
from typing import Optional
from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Profile
from ..models.enums import UserRole
from ..schemas.booking import BookingResponse
from ..schemas.handover import (
    CheckoutRequest,
    FacilityOccupancyRequest,
    ReturnRequest,
    VerifyReturnRequest,
    BookingConditionResponse,
    ReturnComparisonResponse,
)
from ..core.deps import get_current_user, require_roles
from ..services.handover_service import HandoverService

router = APIRouter(tags=["Physical Handover & Return Verification"])

@router.post("/bookings/{id}/checkout", response_model=BookingResponse)
def checkout_equipment(
    id: uuid.UUID,
    body: CheckoutRequest,
    request: Request,
    user: Profile = Depends(require_roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    """
    Staff check-out: verifies student booking code/signed QR pass, records condition & photos, transitions to CHECKED_OUT.
    """
    client_ip = request.client.host if request.client else None
    booking = HandoverService.checkout_equipment(
        db=db,
        booking_id=id,
        user=user,
        data=body,
        client_ip=client_ip,
    )
    return BookingResponse.model_validate(booking)

@router.post("/bookings/{id}/confirm-pickup", response_model=BookingConditionResponse)
def confirm_pickup(
    id: uuid.UUID,
    request: Request,
    user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Student confirms physical receipt of the resource on their mobile/web app.
    """
    client_ip = request.client.host if request.client else None
    cond = HandoverService.confirm_pickup(db=db, booking_id=id, user=user, client_ip=client_ip)
    return BookingConditionResponse.model_validate(cond)

@router.post("/bookings/{id}/checkin-occupancy", response_model=BookingResponse)
def checkin_occupancy(
    id: uuid.UUID,
    body: FacilityOccupancyRequest,
    request: Request,
    user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Facility check-in: records attendee headcount arrival and room condition.
    """
    client_ip = request.client.host if request.client else None
    booking = HandoverService.checkin_occupancy(
        db=db,
        booking_id=id,
        user=user,
        data=body,
        client_ip=client_ip,
    )
    return BookingResponse.model_validate(booking)

@router.post("/bookings/{id}/return", response_model=BookingResponse)
def submit_return(
    id: uuid.UUID,
    body: ReturnRequest,
    request: Request,
    user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Student submits equipment return with notes & inspection photos -> status RETURN_PENDING.
    """
    client_ip = request.client.host if request.client else None
    booking = HandoverService.submit_return(
        db=db,
        booking_id=id,
        user=user,
        data=body,
        client_ip=client_ip,
    )
    return BookingResponse.model_validate(booking)

@router.post("/bookings/{id}/verify-return", response_model=ReturnComparisonResponse)
def verify_return(
    id: uuid.UUID,
    body: VerifyReturnRequest,
    request: Request,
    user: Profile = Depends(require_roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    """
    Staff verifies return: compares pickup condition against return condition.
    If damaged or missing, requires incident creation and deactivates unit. Otherwise completes booking.
    """
    client_ip = request.client.host if request.client else None
    return HandoverService.verify_return(
        db=db,
        booking_id=id,
        user=user,
        data=body,
        client_ip=client_ip,
    )

