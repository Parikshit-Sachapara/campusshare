import enum

class UserRole(str, enum.Enum):
    STUDENT = "STUDENT"
    OWNER = "OWNER"
    MANAGER = "MANAGER"
    ADMIN = "ADMIN"

class ResourceType(str, enum.Enum):
    EQUIPMENT = "EQUIPMENT"
    FACILITY = "FACILITY"

class ResourceStatus(str, enum.Enum):
    AVAILABLE = "AVAILABLE"
    MAINTENANCE = "MAINTENANCE"
    DISABLED = "DISABLED"
    ARCHIVED = "ARCHIVED"

class UnitCondition(str, enum.Enum):
    EXCELLENT = "EXCELLENT"
    GOOD = "GOOD"
    FAIR = "FAIR"
    DAMAGED = "DAMAGED"

class BookingStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    WAITLISTED = "WAITLISTED"
    CHECKED_OUT = "CHECKED_OUT"
    RETURN_PENDING = "RETURN_PENDING"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"
    OVERDUE = "OVERDUE"
    INCIDENT_REPORTED = "INCIDENT_REPORTED"

class ConditionPhase(str, enum.Enum):
    PICKUP = "PICKUP"
    RETURN = "RETURN"

class WaitlistStatus(str, enum.Enum):
    WAITING = "WAITING"
    OFFERED = "OFFERED"
    ACCEPTED = "ACCEPTED"
    EXPIRED = "EXPIRED"
    CANCELLED = "CANCELLED"

class IncidentType(str, enum.Enum):
    DAMAGE = "DAMAGE"
    MISSING = "MISSING"
    LATE_RETURN = "LATE_RETURN"
    UNAUTHORIZED_USE = "UNAUTHORIZED_USE"
    SAFETY_VIOLATION = "SAFETY_VIOLATION"
    POLICY_VIOLATION = "POLICY_VIOLATION"
    OTHER = "OTHER"

class IncidentSeverity(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"

class IncidentStatus(str, enum.Enum):
    REPORTED = "REPORTED"
    UNDER_REVIEW = "UNDER_REVIEW"
    INVESTIGATING = "INVESTIGATING"
    RESOLVED = "RESOLVED"
    CLOSED = "CLOSED"

class LimitScope(str, enum.Enum):
    GLOBAL = "GLOBAL"
    CATEGORY = "CATEGORY"
    RESOURCE = "RESOURCE"
