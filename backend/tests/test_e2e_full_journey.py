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
from app.models import Profile, Resource, ResourceUnit, Booking, AuditLog
from app.core.security import create_access_token

@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c

@pytest.fixture(scope="module")
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_auth_headers(db, email: str) -> tuple:
    user = db.query(Profile).filter_by(email=email).first()
    assert user is not None, f"Seed user {email} not found"
    token = create_access_token({"sub": str(user.id), "role": user.role.value, "email": user.email})
    return user, {"Authorization": f"Bearer {token}"}

def test_full_judge_journey_e2e(client, db_session):
    """
    Complete End-to-End Judge Journey:
    1. Student2 is BLOCKED on DSLR (no required training).
    2. Student1 requests Canon DSLR -> PENDING (requires manager approval).
    3. Manager reviews & approves booking -> APPROVED + student notification.
    4. Owner checks out equipment (QR token validation, condition EXCELLENT) -> CHECKED_OUT.
    5. Student1 confirms pickup and submits return -> RETURN_PENDING.
    6. Owner verifies return (pristine condition) -> COMPLETED.
    7. Booking timeline shows full 7-step narrative history.
    8. Admin views analytics and sees completed booking stats updated.
    """
    # 0. Load Demo Personas
    student1, s1_headers = get_auth_headers(db_session, "student1@campusshare.demo")
    student2, s2_headers = get_auth_headers(db_session, "student2@campusshare.demo")
    manager, mgr_headers = get_auth_headers(db_session, "manager@campusshare.demo")
    owner, owner_headers = get_auth_headers(db_session, "owner@campusshare.demo")
    admin, admin_headers = get_auth_headers(db_session, "admin@campusshare.demo")

    # Fetch initial analytics
    r_init_stats = client.get("/analytics/overview", headers=admin_headers)
    assert r_init_stats.status_code == 200
    init_completed = r_init_stats.json()["totals"]["completed_bookings"]

    # Locate Canon DSLR resource
    dslr = db_session.query(Resource).filter(Resource.name.like("%Canon EOS DSLR%")).first()
    assert dslr is not None
    assert dslr.training_required is True

    # -------------------------------------------------------------
    # Step 1: Student2 attempts to book Canon DSLR -> BLOCKED (No Training)
    # -------------------------------------------------------------
    now = datetime.now(timezone.utc)
    start_ts = (now + timedelta(days=6)).replace(hour=10, minute=0, second=0, microsecond=0)
    end_ts = start_ts + timedelta(hours=2)

    r_s2_block = client.post("/bookings", json={
        "resource_id": str(dslr.id),
        "start_ts": start_ts.isoformat(),
        "end_ts": end_ts.isoformat(),
        "purpose": "Filmmaking club project attempt without training",
    }, headers=s2_headers)
    assert r_s2_block.status_code == 409
    msg = r_s2_block.json()["message"]
    assert "training" in msg.lower() or "mandatory" in msg.lower()

    # -------------------------------------------------------------
    # Step 2: Student1 requests Canon DSLR -> SUCCESS (PENDING approval)
    # -------------------------------------------------------------
    r_s1_req = client.post("/bookings", json={
        "resource_id": str(dslr.id),
        "start_ts": start_ts.isoformat(),
        "end_ts": end_ts.isoformat(),
        "purpose": "Final Year Cinematic Capstone Documentary",
    }, headers=s1_headers)
    if r_s1_req.status_code != 201:
        print("FAIL REASON:", r_s1_req.json())
    assert r_s1_req.status_code == 201
    booking_id = r_s1_req.json()["id"]
    booking_code = r_s1_req.json()["booking_code"]
    assert r_s1_req.json()["status"] == "PENDING"

    # -------------------------------------------------------------
    # Step 3: Manager approves booking -> APPROVED + Notification
    # -------------------------------------------------------------
    r_appr = client.post(f"/bookings/{booking_id}/approve", headers=mgr_headers)
    assert r_appr.status_code == 200
    assert r_appr.json()["status"] == "APPROVED"

    # Verify student1 received notification
    r_notif = client.get("/notifications", headers=s1_headers)
    assert r_notif.status_code == 200
    notifs = r_notif.json()["items"]
    assert any("approved" in n["title"].lower() or "approved" in n["message"].lower() for n in notifs)

    # -------------------------------------------------------------
    # Step 4: Owner checks out equipment -> CHECKED_OUT
    # -------------------------------------------------------------
    r_checkout = client.post(f"/bookings/{booking_id}/checkout", json={
        "booking_code_or_token": booking_code,
        "condition": "EXCELLENT",
        "notes": "Lens, body, battery pack, and SD card inspected",
        "photo_urls": ["https://images.unsplash.com/photo-handover-1.jpg"],
        "confirmed_in_person": True,
    }, headers=owner_headers)
    assert r_checkout.status_code == 200
    assert r_checkout.json()["status"] == "CHECKED_OUT"

    # -------------------------------------------------------------
    # Step 5: Student confirms pickup & later submits return -> RETURN_PENDING
    # -------------------------------------------------------------
    r_cp = client.post(f"/bookings/{booking_id}/confirm-pickup", headers=s1_headers)
    assert r_cp.status_code == 200

    r_ret = client.post(f"/bookings/{booking_id}/return", json={
        "notes": "Shooting wrapped cleanly; camera wiped down",
        "photo_urls": ["https://images.unsplash.com/photo-return-1.jpg"],
    }, headers=s1_headers)
    assert r_ret.status_code == 200
    assert r_ret.json()["status"] == "RETURN_PENDING"

    # -------------------------------------------------------------
    # Step 6: Owner verifies return -> COMPLETED
    # -------------------------------------------------------------
    r_ver = client.post(f"/bookings/{booking_id}/verify-return", json={
        "final_condition": "EXCELLENT",
        "notes": "Return verified in person; unit pristine",
    }, headers=owner_headers)
    assert r_ver.status_code == 200
    assert r_ver.json()["status"] == "COMPLETED"

    # -------------------------------------------------------------
    # Step 7: Inspect 7-Step Narrative Timeline History
    # -------------------------------------------------------------
    r_timeline = client.get(f"/bookings/{booking_id}", headers=s1_headers)
    assert r_timeline.status_code == 200
    timeline = r_timeline.json()["timeline"]
    assert len(timeline) >= 6
    actions = [t["action"] for t in timeline]
    assert "BOOKING_REQUESTED" in actions
    assert "BOOKING_APPROVED" in actions
    assert "BOOKING_CHECKED_OUT" in actions
    assert "BOOKING_COMPLETED" in actions

    # -------------------------------------------------------------
    # Step 8: Admin Analytics verifies completed booking delta
    # -------------------------------------------------------------
    r_final_stats = client.get("/analytics/overview", headers=admin_headers)
    assert r_final_stats.status_code == 200
    final_completed = r_final_stats.json()["totals"]["completed_bookings"]
    assert final_completed == init_completed + 1
