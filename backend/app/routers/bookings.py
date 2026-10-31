import uuid
from typing import Optional, List
from fastapi import APIRouter, Depends, Request, Header, Query, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Profile, Booking
from ..models.enums import BookingStatus, UserRole
from ..schemas.booking import (
    BookingCreate,
    BookingResponse,
    BookingDetailResponse,
    BookingValidateRequest,
    BookingValidateResponse,
    BookingCancelRequest,
    BookingOverridePriorityRequest,
)
from ..schemas.common import PaginatedResponse, SuccessResponse
from ..core.deps import get_current_user, require_roles
from ..services.booking_service import BookingService
from ..services.approval_service import ApprovalService

router = APIRouter(prefix="/bookings", tags=["Bookings & Reservation Engine"])

@router.post("/validate", response_model=BookingValidateResponse)
def validate_booking(
    req: BookingValidateRequest,
    user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Real-time dry run eligibility and constraint validation for frontend live feedback.
    """
    return BookingService.validate_booking(db=db, user=user, data=req)

@router.post("", response_model=BookingResponse, status_code=status.HTTP_201_CREATED)
def create_booking(
    req: BookingCreate,
    request: Request,
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
    user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Creates a new booking request in ONE atomic transaction with row locking.
    Auto-approves when permitted or enters pending queue with fairness score.
    """
    client_ip = request.client.host if request.client else None
    booking = BookingService.create_booking(
        db=db,
        user=user,
        data=req,
        idempotency_key=idempotency_key,
        client_ip=client_ip,
    )
    return BookingResponse.model_validate(booking)

@router.get("/all", response_model=PaginatedResponse[BookingResponse])
def get_all_bookings(
    status: Optional[BookingStatus] = Query(None, description="Filter by status (PENDING, APPROVED, etc.)"),
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=500),
    user: Profile = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.OWNER)),
    db: Session = Depends(get_db),
):
    """
    Lists all bookings across the institution for Admin and Manager views.
    """
    from sqlalchemy import desc
    query = db.query(Booking)
    if status:
        query = query.filter(Booking.status == status)
    total = query.count()
    items = query.order_by(desc(Booking.created_at)).offset((page - 1) * page_size).limit(page_size).all()
    total_pages = max(1, (total + page_size - 1) // page_size)
    return PaginatedResponse(
        items=[BookingResponse.model_validate(b) for b in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )

@router.get("/my", response_model=PaginatedResponse[BookingResponse])
@router.get("/me", response_model=PaginatedResponse[BookingResponse])
def get_my_bookings(
    status: Optional[BookingStatus] = Query(None, description="Filter by status (PENDING, APPROVED, etc.)"),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
    user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Lists all bookings requested by the authenticated student.
    """
    items, total = BookingService.get_student_bookings(
        db=db,
        student_id=user.id,
        status_filter=status,
        page=page,
        page_size=page_size,
    )
    total_pages = max(1, (total + page_size - 1) // page_size)
    return PaginatedResponse(
        items=[BookingResponse.model_validate(b) for b in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )

@router.get("/{id}", response_model=BookingDetailResponse)
def get_booking_details(
    id: uuid.UUID,
    user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns full booking information including complete timeline from audit_logs.
    """
    return BookingService.get_booking_details_with_timeline(db=db, booking_id=id, user=user)

@router.post("/{id}/cancel", response_model=BookingResponse)
def cancel_booking(
    id: uuid.UUID,
    body: Optional[BookingCancelRequest] = None,
    request: Request = None,
    user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Cancels an active or pending booking and triggers waitlist redistribution.
    """
    client_ip = request.client.host if request and request.client else None
    reason = body.reason if body else None
    cancelled = BookingService.cancel_booking(
        db=db,
        booking_id=id,
        user=user,
        reason=reason,
        client_ip=client_ip,
    )
    return BookingResponse.model_validate(cancelled)

@router.post("/{id}/override-priority", response_model=BookingResponse)
def override_priority(
    id: uuid.UUID,
    body: BookingOverridePriorityRequest,
    request: Request,
    user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Allows Lab Managers or Administrators to override priority score with reason.
    """
    client_ip = request.client.host if request.client else None
    updated = BookingService.override_priority(
        db=db,
        booking_id=id,
        user=user,
        new_score=body.priority_score,
        reason=body.reason,
        client_ip=client_ip,
    )
    return BookingResponse.model_validate(updated)

@router.post("/{id}/accept-alternative", response_model=BookingResponse)
def accept_alternative(
    id: uuid.UUID,
    request: Request,
    user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Student accepts an alternative slot suggested by the lab approver.
    """
    client_ip = request.client.host if request.client else None
    updated = ApprovalService.accept_alternative(
        db=db,
        booking_id=id,
        user=user,
        client_ip=client_ip,
    )
    return BookingResponse.model_validate(updated)

