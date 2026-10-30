import os
import sys
import uuid
import pytest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.main import app
from app.database import SessionLocal
from app.models import Profile, Resource, ResourceCategory, Department, ResourceUnit, Booking, UserRole, ResourceStatus, BookingStatus
from app.core.security import get_password_hash, create_access_token
from app.core.rate_limit import login_rate_limiter

@pytest.fixture(autouse=True)
def reset_rate_limit_between_tests():
    login_rate_limiter.reset()
    yield
    login_rate_limiter.reset()

@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c

@pytest.fixture(scope="module")
def db_session():
    session = SessionLocal()
    yield session
    session.close()

# -------------------------------------------------------------
# 1. AUTHENTICATION TESTS
# -------------------------------------------------------------
def test_student_registration_forces_student_role(client):
    unique_email = f"std_reg_{uuid.uuid4().hex[:6]}@campusshare.demo"
    res = client.post("/auth/register", json={
        "email": unique_email,
        "password": "Password123!",
        "full_name": "Test Student Registered",
        "role": "ADMIN", # Try to elevate to ADMIN during self-registration
    })
    assert res.status_code == 201
    data = res.json()
    assert data["email"] == unique_email
    # Security requirement: Role MUST be forced to STUDENT
    assert data["role"] == "STUDENT"
    assert data["is_verified"] is True

def test_owner_registration_creates_unverified_account(client):
    unique_email = f"owner_reg_{uuid.uuid4().hex[:6]}@campusshare.demo"
    res = client.post("/auth/register", json={
        "email": unique_email,
        "password": "Password123!",
        "full_name": "Test Lab Owner",
        "role": "OWNER",
    })
    assert res.status_code == 201
    data = res.json()
    assert data["role"] == "OWNER"
    # Security requirement: Owner registration requires admin verification
    assert data["is_verified"] is False

def test_duplicate_email_registration_fails(client):
    unique_email = f"dup_{uuid.uuid4().hex[:6]}@campusshare.demo"
    res1 = client.post("/auth/register", json={
        "email": unique_email,
        "password": "Password123!",
        "full_name": "Original User",
    })
    assert res1.status_code == 201

    res2 = client.post("/auth/register", json={
        "email": unique_email,
        "password": "Password123!",
        "full_name": "Duplicate User",
    })
    assert res2.status_code == 409
    assert res2.json()["code"] == "EMAIL_ALREADY_REGISTERED"

def test_login_success_and_jwt_issuance(client):
    res = client.post("/auth/login", json={
        "email": "student1@campusshare.demo",
        "password": "Campus@123",
    })
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "student1@campusshare.demo"
    assert data["user"]["role"] == "STUDENT"

def test_login_invalid_password_fails(client):
    res = client.post("/auth/login", json={
        "email": "student1@campusshare.demo",
        "password": "WrongPassword123",
    })
    assert res.status_code == 401
    assert res.json()["code"] == "INVALID_CREDENTIALS"

def test_rate_limiting_enforced_after_5_attempts(client):
    """5 attempts within 60 seconds are allowed; 6th attempt must return 429."""
    for _ in range(5):
        client.post("/auth/login", json={
            "email": "student1@campusshare.demo",
            "password": "WrongPassword",
        })
    res_blocked = client.post("/auth/login", json={
        "email": "student1@campusshare.demo",
        "password": "Campus@123",
    })
    assert res_blocked.status_code == 429
    assert res_blocked.json()["code"] == "RATE_LIMIT_EXCEEDED"

def test_suspended_user_blocked_at_login(client, db_session):
    suspended_email = f"suspended_{uuid.uuid4().hex[:6]}@campusshare.demo"
    p = Profile(
        email=suspended_email,
        password_hash=get_password_hash("Campus@123"),
        full_name="Suspended Student",
        role=UserRole.STUDENT,
        is_active=False,
        suspended_reason="Multiple no-shows on laboratory equipment.",
    )
    db_session.add(p)
    db_session.commit()

    res = client.post("/auth/login", json={
        "email": suspended_email,
        "password": "Campus@123",
    })
    assert res.status_code == 403
    assert res.json()["code"] == "ACCOUNT_SUSPENDED"

def test_get_me_and_patch_me(client):
    login_res = client.post("/auth/login", json={
        "email": "student1@campusshare.demo",
        "password": "Campus@123",
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # GET /me
    me_res = client.get("/auth/me", headers=headers)
    assert me_res.status_code == 200
    assert me_res.json()["email"] == "student1@campusshare.demo"

    # PATCH /me
    patch_res = client.patch("/auth/me", json={"phone": "+91 99999 88888"}, headers=headers)
    assert patch_res.status_code == 200
    assert patch_res.json()["phone"] == "+91 99999 88888"


# -------------------------------------------------------------
# 2. RBAC & HORIZONTAL PRIVILEGE ESCALATION TESTS
# -------------------------------------------------------------
def test_student_cannot_create_resource(client):
    """
    RBAC Rule: Only OWNER, MANAGER, or ADMIN can create resources.
    STUDENT role must receive 403 Forbidden.
    """
    login_res = client.post("/auth/login", json={
        "email": "student1@campusshare.demo",
        "password": "Campus@123",
    })
    token = login_res.json()["access_token"]

    dept_res = client.get("/departments")
    cat_res = client.get("/categories")
    dept_id = dept_res.json()[0]["id"]
    cat_id = cat_res.json()[0]["id"]

    res = client.post("/resources", json={
        "name": "Illicit Student Resource",
        "category_id": cat_id,
        "department_id": dept_id,
        "location": "Student Dorms",
        "quantity": 1,
    }, headers={"Authorization": f"Bearer {token}"})

    assert res.status_code == 403
    assert res.json()["code"] == "FORBIDDEN_ROLE"

def test_horizontal_privilege_escalation_booking_access(client, db_session):
    """
    OBJECT-LEVEL SECURITY:
    Student A attempting to access Student B's booking must receive 403 Forbidden.
    """
    student1 = db_session.query(Profile).filter_by(email="student1@campusshare.demo").first()
    student2 = db_session.query(Profile).filter_by(email="student2@campusshare.demo").first()
    resource = db_session.query(Resource).filter_by(name="Canon EOS DSLR Camera Kit").first()

    # Create a booking belonging strictly to Student 2
    b2 = Booking(
        booking_code=f"PRIV-ESC-{uuid.uuid4().hex[:6]}",
        student_id=student2.id,
        resource_id=resource.id,
        start_ts=datetime.now(timezone.utc) + timedelta(days=5),
        end_ts=datetime.now(timezone.utc) + timedelta(days=5, hours=2),
        purpose="Private Capstone Booking for Diya",
        status=BookingStatus.PENDING,
    )
    db_session.add(b2)
    db_session.commit()

    # Login as Student 1 (Aarav)
    login_res = client.post("/auth/login", json={
        "email": "student1@campusshare.demo",
        "password": "Campus@123",
    })
    token_s1 = login_res.json()["access_token"]

    # Student 1 attempts to check booking rights or access
    from app.core.deps import check_booking_ownership_or_manager
    from app.core.exceptions import CampusShareException

    with pytest.raises(CampusShareException) as exc_info:
        check_booking_ownership_or_manager(b2, student1)

    assert exc_info.value.code == "HORIZONTAL_PRIVILEGE_VIOLATION"


# -------------------------------------------------------------
# 3. RESOURCES API TESTS
# -------------------------------------------------------------
def test_resource_search_and_filtering(client):
    # 1. Search by keyword (trigram / ILIKE)
    res = client.get("/resources?q=Oscilloscope")
    assert res.status_code == 200
    data = res.json()
    assert data["total"] >= 1
    assert any("Oscilloscope" in item["name"] for item in data["items"])

    # 2. Search by another keyword
    res_dslr = client.get("/resources?q=Canon")
    assert res_dslr.status_code == 200
    assert any("Canon" in item["name"] for item in res_dslr.json()["items"])

def test_resource_details_and_computed_availability(client, db_session):
    res_obj = db_session.query(Resource).filter_by(name="Canon EOS DSLR Camera Kit").first()
    assert res_obj is not None

    res = client.get(f"/resources/{res_obj.id}")
    assert res.status_code == 200
    detail = res.json()
    assert detail["name"] == "Canon EOS DSLR Camera Kit"
    assert "units" in detail
    assert "usage_summary" in detail

    # Check date availability slots
    tomorrow_str = (datetime.now(timezone.utc) + timedelta(days=1)).strftime("%Y-%m-%d")
    avail_res = client.get(f"/resources/{res_obj.id}/availability?date={tomorrow_str}")
    assert avail_res.status_code == 200
    avail_data = avail_res.json()
    assert "slots" in avail_data

def test_eligibility_check_student1_vs_student2(client, db_session):
    """
    Evaluates resource eligibility:
    - student1 has DSLR safety training -> passes!
    - student2 lacks DSLR training -> fails with informative message!
    """
    res_obj = db_session.query(Resource).filter_by(name="Canon EOS DSLR Camera Kit").first()

    # Login student1 (trained)
    s1_token = client.post("/auth/login", json={
        "email": "student1@campusshare.demo",
        "password": "Campus@123",
    }).json()["access_token"]

    elig1 = client.get(f"/resources/{res_obj.id}/eligibility", headers={"Authorization": f"Bearer {s1_token}"})
    assert elig1.status_code == 200
    data1 = elig1.json()
    assert data1["eligible"] is True
    # Training check passed
    assert any(c["name"] == "Safety Certification" and c["passed"] is True for c in data1["checks"])

    # Login student2 (untrained)
    s2_token = client.post("/auth/login", json={
        "email": "student2@campusshare.demo",
        "password": "Campus@123",
    }).json()["access_token"]

    elig2 = client.get(f"/resources/{res_obj.id}/eligibility", headers={"Authorization": f"Bearer {s2_token}"})
    assert elig2.status_code == 200
    data2 = elig2.json()
    assert data2["eligible"] is False
    # Training check failed with helpful message
    training_check = next(c for c in data2["checks"] if c["name"] == "Safety Certification")
    assert training_check["passed"] is False
    assert "Prerequisite Missing" in training_check["message"]

def test_health_endpoint(client):
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "online"
    assert res.json()["database"] == "healthy"

def test_refresh_token_endpoint(client):
    """Verifies that /auth/refresh accepts the refresh_token string from login."""
    login_res = client.post("/auth/login", json={
        "email": "student1@campusshare.demo",
        "password": "Campus@123",
    })
    assert login_res.status_code == 200
    refresh_token = login_res.json()["refresh_token"]
    assert refresh_token is not None

    # Call /auth/refresh with request body containing refresh_token
    refresh_res = client.post("/auth/refresh", json={
        "refresh_token": refresh_token
    })
    assert refresh_res.status_code == 200
    data = refresh_res.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "student1@campusshare.demo"

def test_registration_accepts_both_dept_id_and_department_id(client):
    """Verifies both 'dept_id' and 'department_id' work seamlessly with code 'CS'."""
    # Test with dept_id
    email1 = f"std_dept_{uuid.uuid4().hex[:6]}@campusshare.demo"
    res1 = client.post("/auth/register", json={
        "email": email1,
        "password": "Password123!",
        "full_name": "Dept Id User",
        "dept_id": "CS",
    })
    assert res1.status_code == 201
    assert res1.json()["department_id"] is not None

    # Test with department_id
    email2 = f"std_dept_{uuid.uuid4().hex[:6]}@campusshare.demo"
    res2 = client.post("/auth/register", json={
        "email": email2,
        "password": "Password123!",
        "full_name": "Department Id User",
        "department_id": "CS",
    })
    assert res2.status_code == 201
    assert res2.json()["department_id"] is not None
