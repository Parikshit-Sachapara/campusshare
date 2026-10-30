import uuid
from typing import List
from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Profile
from ..schemas.waitlist import WaitlistCreate, WaitlistResponse
from ..schemas.booking import BookingResponse
from ..schemas.common import SuccessResponse
from ..core.deps import get_current_user
from ..services.booking_service import BookingService
from ..core.exceptions import CampusShareException
from ..models.enums import WaitlistStatus
from ..models import WaitingList
from datetime import datetime, timezone

router = APIRouter(prefix="/waitlist", tags=["Waiting List & Queue Redistribution"])

@router.post("", response_model=WaitlistResponse, status_code=status.HTTP_201_CREATED)
def join_waitlist(
    req: WaitlistCreate,
    user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Adds user to the prioritized waiting list for a resource.
    """
    entry = BookingService.join_waitlist(
        db=db,
        user=user,
        resource_id=req.resource_id,
        desired_start_ts=req.desired_start_ts,
        desired_end_ts=req.desired_end_ts,
    )
    return WaitlistResponse.model_validate(entry)

@router.delete("/{id}", response_model=SuccessResponse)
def leave_waitlist(
    id: uuid.UUID,
    user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Removes the user from the waiting list.
    """
    BookingService.leave_waitlist(db=db, waitlist_id=id, user=user)
    return SuccessResponse(message="Successfully left waiting list.")

@router.get("/me", response_model=List[WaitlistResponse])
def get_my_waitlist(
    user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns user's active waitlist entries with calculated live queue positions.
    """
    return BookingService.get_my_waitlist(db=db, user=user)

@router.post("/{id}/accept", response_model=BookingResponse)
def accept_waitlist_offer(
    id: uuid.UUID,
    request: Request,
    user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Student accepts an offered slot from the waiting list, creating a confirmed booking.
    """
    entry = db.query(WaitingList).filter_by(id=id).first()
    if not entry:
        raise CampusShareException(code="WAITLIST_NOT_FOUND", message="Waitlist entry not found.", status_code=404)
    if entry.student_id != user.id:
        raise CampusShareException(code="FORBIDDEN_ACTION", message="Unauthorized.", status_code=403)
    if entry.status != WaitlistStatus.OFFERED:
        raise CampusShareException(
            code="OFFER_NOT_ACTIVE",
            message=f"Cannot accept offer in '{entry.status.value}' state.",
            status_code=400,
        )

    now = datetime.now(timezone.utc)
    if entry.offer_expires_at and entry.offer_expires_at < now:
        entry.status = WaitlistStatus.EXPIRED
        db.commit()
        raise CampusShareException(
            code="OFFER_EXPIRED",
            message="This waitlist offer has expired.",
            status_code=400,
        )

    # Create Booking
    from ..schemas.booking import BookingCreate
    booking_req = BookingCreate(
        resource_id=entry.resource_id,
        start_ts=entry.desired_start_ts,
        end_ts=entry.desired_end_ts,
        attendees=1,
        purpose="Accepted from Priority Waiting List offer",
    )
    client_ip = request.client.host if request.client else None
    booking = BookingService.create_booking(db=db, user=user, data=booking_req, client_ip=client_ip)

    entry.status = WaitlistStatus.ACCEPTED
    db.commit()

    return BookingResponse.model_validate(booking)

