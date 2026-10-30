from typing import Set, Dict
from ..models.enums import IncidentStatus, UserRole
from ..core.exceptions import CampusShareException
from fastapi import status

class IncidentStateMachine:
    """
    State machine for Incident Lifecycles:
    REPORTED -> UNDER_REVIEW -> INVESTIGATING -> RESOLVED -> CLOSED
    """

    ALLOWED_TRANSITIONS: Dict[IncidentStatus, Set[IncidentStatus]] = {
        IncidentStatus.REPORTED: {
            IncidentStatus.UNDER_REVIEW,
            IncidentStatus.INVESTIGATING,
            IncidentStatus.CLOSED,
        },
        IncidentStatus.UNDER_REVIEW: {
            IncidentStatus.INVESTIGATING,
            IncidentStatus.RESOLVED,
            IncidentStatus.CLOSED,
        },
        IncidentStatus.INVESTIGATING: {
            IncidentStatus.RESOLVED,
            IncidentStatus.CLOSED,
        },
        IncidentStatus.RESOLVED: {
            IncidentStatus.CLOSED,
        },
        IncidentStatus.CLOSED: set(),
    }

    @classmethod
    def can_transition(cls, current: IncidentStatus, target: IncidentStatus) -> bool:
        return target in cls.ALLOWED_TRANSITIONS.get(current, set())

    @classmethod
    def validate_transition(
        cls,
        current: IncidentStatus,
        target: IncidentStatus,
        actor_role: UserRole,
        resolution: str = None,
    ):
        if current == target:
            return

        # Only Manager or Admin can transition to RESOLVED or CLOSED
        if target in [IncidentStatus.RESOLVED, IncidentStatus.CLOSED]:
            if actor_role not in [UserRole.MANAGER, UserRole.ADMIN]:
                raise CampusShareException(
                    code="FORBIDDEN_RESOLUTION",
                    message="Only Facility Managers or Administrators can resolve or close an incident.",
                    status_code=status.HTTP_403_FORBIDDEN,
                )
            if not resolution or not resolution.strip():
                raise CampusShareException(
                    code="RESOLUTION_REQUIRED",
                    message="A detailed resolution explanation is mandatory when resolving or closing an incident.",
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                )

        if not cls.can_transition(current, target):
            raise CampusShareException(
                code="INVALID_INCIDENT_TRANSITION",
                message=f"Cannot transition incident from {current.value} to {target.value}.",
                status_code=status.HTTP_409_CONFLICT,
            )
