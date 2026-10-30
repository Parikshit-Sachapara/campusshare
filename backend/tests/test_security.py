import os
import sys
import io
import uuid
import jwt
from datetime import datetime, timedelta, timezone
import pytest
from fastapi.testclient import TestClient

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.main import app
from app.database import SessionLocal
from app.models import Profile, Resource, ResourceUnit, ResourceCategory, Department, Booking, UsageLimit, UserRole, ResourceType, ResourceStatus, UnitCondition, BookingStatus, LimitScope
from app.core.security import create_access_token
from app.config import settings

@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c

@pytest.fixture(scope="function")
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.rollback()
        db.close()

def create_user(db, email_prefix, role=UserRole.STUDENT, is_verified=True):
    dept = db.query(Department).first()
    p = Profile(
        email=f"{email_prefix}_{uuid.uuid4().hex[:6]}@campusshare.edu",
        password_hash="dummy_pw",
        full_name=f"SecUser {email_prefix}",
        department_id=dept.id if dept else None,
        role=role,
        is_verified=is_verified,
        is_active=True,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    token = create_access_token({"sub": str(p.id), "role": p.role.value if hasattr(p.role, "value") else str(p.role), "email": p.email})
    headers = {"Authorization": f"Bearer {token}"}
    return p, headers

def test_jwt_tampering_and_forgery(client, db_session):
    """
    Verifies that forged signatures, expired tokens, and tampered claims are strictly rejected with 401.
    """
    user, _ = create_user(db_session, "jwt_tamper")

    # 1. Invalid signature (signed with attacker secret)
    forged_token = jwt.encode(
        {"sub": str(user.id), "role": "ADMIN", "exp": datetime.now(timezone.utc) + timedelta(hours=1)},
        "attacker-evil-secret-key-1234567890",
        algorithm="HS256",
    )
    r1 = client.get("/auth/me", headers={"Authorization": f"Bearer {forged_token}"})
    assert r1.status_code == 401

    # 2. Expired token
    expired_token = jwt.encode(
        {"sub": str(user.id), "role": "STUDENT", "exp": datetime.now(timezone.utc) - timedelta(hours=1)},
        settings.SECRET_KEY,
        algorithm="HS256",
    )
    r2 = client.get("/auth/me", headers={"Authorization": f"Bearer {expired_token}"})
    assert r2.status_code == 401

    # 3. Completely malformed token
    r3 = client.get("/auth/me", headers={"Authorization": "Bearer not.a.valid.jwt.token"})
    assert r3.status_code == 401

def test_role_escalation_by_editing_payload(client, db_session):
    """
    Verifies that students cannot self-escalate their role via registration,
    profile updates, or privileged administrative endpoints.
    """
    student, student_headers = create_user(db_session, "role_esc", role=UserRole.STUDENT)

    # 1. Registration role escalation attempt
    r_reg = client.post("/auth/register", json={
        "email": f"attacker_{uuid.uuid4().hex[:6]}@campusshare.edu",
        "password": "Password123!",
        "full_name": "Attacker Trying Admin",
        "role": "ADMIN",
    })
    # Should either succeed as STUDENT or reject role escalation
    if r_reg.status_code == 201:
        assert r_reg.json()["role"] == "STUDENT"

    # 2. Profile update escalation attempt
    r_patch = client.patch("/auth/me", json={"role": "ADMIN"}, headers=student_headers)
    assert r_patch.status_code in [200, 422]
    db_session.refresh(student)
    assert student.role == UserRole.STUDENT

    # 3. Attempt accessing Manager-only approvals endpoint
    dummy_id = uuid.uuid4()
    r_approve = client.post(f"/bookings/{dummy_id}/approve", headers=student_headers)
    assert r_approve.status_code == 403

def test_idor_on_bookings_and_incidents(client, db_session):
    """
    Verifies that Student A cannot view, cancel, or tamper with Student B's bookings or private incidents.
    """
    cat = db_session.query(ResourceCategory).first()
    dept = db_session.query(Department).first()
    owner = db_session.query(Profile).filter_by(role=UserRole.OWNER).first()
    student_a, headers_a = create_user(db_session, "idor_a")
    student_b, headers_b = create_user(db_session, "idor_b")

    now = datetime.now(timezone.utc)
    res = Resource(
        name=f"IDOR Resource {uuid.uuid4().hex[:6]}",
        resource_type=ResourceType.FACILITY,
        category_id=cat.id,
        department_id=dept.id,
        owner_id=owner.id,
        location="Seminar Hall B",
        is_restricted=False,
    )
    db_session.add(res)
    db_session.flush()

    b_b = Booking(
        booking_code=f"BK-{uuid.uuid4().hex[:8].upper()}",
        student_id=student_b.id,
        resource_id=res.id,
        start_ts=now + timedelta(days=3),
        end_ts=now + timedelta(days=3, hours=2),
        status=BookingStatus.APPROVED,
        purpose="Confidential Thesis Project",
    )
    db_session.add(b_b)
    db_session.commit()
    db_session.refresh(b_b)

    # Student A cannot access Student B's booking
    r_get = client.get(f"/bookings/{b_b.id}", headers=headers_a)
    assert r_get.status_code in [403, 404]

    # Student A cannot cancel Student B's booking
    r_cancel = client.post(f"/bookings/{b_b.id}/cancel", json={"reason": "IDOR Attack"}, headers=headers_a)
    assert r_cancel.status_code in [403, 404]

    # Student A cannot close incidents
    inc_res = client.post("/incidents", json={
        "resource_id": str(res.id),
        "type": "POLICY_VIOLATION",
        "severity": "LOW",
        "description": "Equipment was left unattended in common area without supervisor.",
    }, headers=headers_b)
    assert inc_res.status_code == 201
    incident_id = inc_res.json()["id"]

    r_inc_close = client.patch(f"/incidents/{incident_id}/status", json={"status": "CLOSED", "resolution_notes": "Fake resolution by student"}, headers=headers_a)
    assert r_inc_close.status_code == 403

    # Unrelated student cannot access private incident evidence without permission
    r_evidence = client.get("/incidents/evidence/secret_tamper_evidence.jpg", headers=headers_a)
    assert r_evidence.status_code in [403, 404]

def test_file_upload_abuse_prevention(client, db_session):
    """
    Verifies that non-image file uploads (.exe, .sh, etc.) and files > 5MB are rejected.
    """
    cat = db_session.query(ResourceCategory).first()
    dept = db_session.query(Department).first()
    owner = db_session.query(Profile).filter_by(role=UserRole.OWNER).first()
    owner_token = create_access_token({"sub": str(owner.id), "role": "OWNER", "email": owner.email})
    owner_headers = {"Authorization": f"Bearer {owner_token}"}

    res = Resource(
        name=f"Upload Test Res {uuid.uuid4().hex[:6]}",
        resource_type=ResourceType.EQUIPMENT,
        category_id=cat.id,
        department_id=dept.id,
        owner_id=owner.id,
        location="Electronics Lab Rm 204",
    )
    db_session.add(res)
    db_session.commit()
    db_session.refresh(res)

    # 1. Upload executable script disguised as text
    bad_file = ("exploit.exe", io.BytesIO(b"MZ\x90\x00\x03\x00\x00\x00"), "application/x-dosexec")
    r_bad_ext = client.post(
        f"/resources/{res.id}/images",
        files={"files": bad_file},
        headers=owner_headers,
    )
    assert r_bad_ext.status_code == 400
    assert "invalid file type" in r_bad_ext.json().get("message", "").lower()

    # 2. Upload oversized file (> 5MB)
    large_payload = b"A" * (6 * 1024 * 1024) # 6MB
    large_file = ("large_photo.jpg", io.BytesIO(large_payload), "image/jpeg")
    r_large = client.post(
        f"/resources/{res.id}/images",
        files={"files": large_file},
        headers=owner_headers,
    )
    assert r_large.status_code == 400
    assert "exceeds maximum allowed size" in r_large.json().get("message", "").lower()

def test_sql_injection_resilience_on_search(client, db_session):
    """
    Verifies that standard SQL injection payloads do not trigger DB errors
    and are safely sanitized by ORM parameters.
    """
    sql_payloads = [
        "' OR '1'='1",
        "'; DROP TABLE resources; --",
        "1 UNION SELECT 1, 'admin', 'pass' --",
        "admin'--",
    ]
    for payload in sql_payloads:
        r = client.get(f"/resources?search={payload}")
        assert r.status_code == 200
        # Check that resources table is still accessible
        assert isinstance(r.json(), dict)
        assert "items" in r.json()

def test_admin_reset_demo_data_rbac(client, db_session):
    """
    Verifies that only users with ADMIN role can reset demo data,
    and Student/Manager attempts are rejected with 403.
    """
    student, student_headers = create_user(db_session, "unauth_reset", role=UserRole.STUDENT)
    manager, manager_headers = create_user(db_session, "mgr_reset", role=UserRole.MANAGER)
    admin = db_session.query(Profile).filter_by(role=UserRole.ADMIN).first()
    admin_token = create_access_token({"sub": str(admin.id), "role": "ADMIN", "email": admin.email})
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Student denied
    r_stu = client.post("/admin/reset-demo-data", headers=student_headers)
    assert r_stu.status_code == 403

    # Manager denied
    r_mgr = client.post("/admin/reset-demo-data", headers=manager_headers)
    assert r_mgr.status_code == 403

    # Admin allowed
    r_adm = client.post("/admin/reset-demo-data", headers=admin_headers)
    assert r_adm.status_code == 200
    assert "reset" in r_adm.json()["message"].lower()
