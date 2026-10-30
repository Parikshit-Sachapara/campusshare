from typing import Set, Dict
from sqlalchemy.orm import Session
from ..models import Booking
from ..models.enums import BookingStatus
from ..core.exceptions import CampusShareException
from fastapi import status

class BookingStateMachine:
    """
    Central State Machine for Booking Lifecycles.
    Validates state transitions before DB operations and protects against race conditions
    via optimistic concurrency control (version column).
    """

    ALLOWED_TRANSITIONS: Dict[BookingStatus, Set[BookingStatus]] = {
        BookingStatus.PENDING: {
            BookingStatus.APPROVED,
            BookingStatus.REJECTED,
            BookingStatus.WAITLISTED,
            BookingStatus.CANCELLED,
        },
        BookingStatus.WAITLISTED: {
            BookingStatus.PENDING,
            BookingStatus.APPROVED,
            BookingStatus.CANCELLED,
        },
        BookingStatus.APPROVED: {
            BookingStatus.CHECKED_OUT,
            BookingStatus.CANCELLED,
        },
        BookingStatus.CHECKED_OUT: {
            BookingStatus.RETURN_PENDING,
            BookingStatus.OVERDUE,
            BookingStatus.INCIDENT_REPORTED,
        },
        BookingStatus.OVERDUE: {
            BookingStatus.RETURN_PENDING,
            BookingStatus.INCIDENT_REPORTED,
        },
        BookingStatus.RETURN_PENDING: {
            BookingStatus.COMPLETED,
            BookingStatus.INCIDENT_REPORTED,
        },
        BookingStatus.INCIDENT_REPORTED: {
            BookingStatus.COMPLETED,
        },
        # Terminal States
        BookingStatus.REJECTED: set(),
        BookingStatus.CANCELLED: set(),
        BookingStatus.COMPLETED: set(),
    }

    @classmethod
    def can_transition(cls, current_status: BookingStatus, target_status: BookingStatus) -> bool:
        allowed = cls.ALLOWED_TRANSITIONS.get(current_status, set())
        return target_status in allowed

    @classmethod
    def transition(
        cls,
        booking: Booking,
        target_status: BookingStatus,
        expected_version: int = None,
    ) -> bool:
        """
        Performs state transition check with optimistic concurrency guard.
        Returns True if status changed, False if already in target state (idempotent duplicate call).
        Throws 409 CampusShareException on invalid transition or version conflict.
        """
        # Idempotent duplicate call handling:
        # e.g. clicking "Approve" twice when booking is already APPROVED
        if booking.status == target_status:
            return False

        # Concurrency / Optimistic locking check
        if expected_version is not None and booking.version != expected_version:
            raise CampusShareException(
                code="CONCURRENT_MODIFICATION",
                message="This booking has been modified concurrently by another transaction. Please refresh and try again.",
                status_code=status.HTTP_409_CONFLICT,
                details={"current_version": booking.version, "expected_version": expected_version}
            )

        # State transition validation
        if not cls.can_transition(booking.status, target_status):
            raise CampusShareException(
                code="INVALID_STATUS_TRANSITION",
                message=f"Illegal state transition: Cannot transition booking from {booking.status.value} to {target_status.value}.",
                status_code=status.HTTP_409_CONFLICT,
                details={
                    "current_status": booking.status.value,
                    "target_status": target_status.value,
                    "allowed_transitions": [s.value for s in cls.ALLOWED_TRANSITIONS.get(booking.status, set())]
                }
            )

        # Advance state and increment optimistic lock version counter
        booking.status = target_status
        booking.version = (booking.version or 1) + 1
        return True

