import os
import sys
import pytest
from fastapi.testclient import TestClient

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.main import app
from app.database import SessionLocal
from app.models import Profile, UserRole
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

def get_auth_headers(db_session, email: str = "admin@campusshare.demo") -> dict:
    user = db_session.query(Profile).filter_by(email=email).first()
    assert user is not None, f"User {email} not found in database."
    token = create_access_token({"sub": str(user.id), "role": user.role.value, "email": user.email})
    return {"Authorization": f"Bearer {token}"}

def test_analytics_overview_admin_manager_access(client, db_session):
    headers = get_auth_headers(db_session, "admin@campusshare.demo")
    res = client.get("/analytics/overview", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "totals" in data
    assert "users" in data["totals"]
    assert "resources" in data["totals"]
    assert "no_show_rate" in data
    assert "avg_approval_minutes" in data
    assert "status_distribution" in data
    assert "most_used_resources" in data
    assert "least_used_resources" in data
    assert "monthly_trend" in data
    assert "department_utilization" in data
    assert "peak_hours_grid" in data
    assert len(data["peak_hours_grid"]) == 7 * 13 # 7 days x 13 hours (8-20)

def test_analytics_student_forbidden_for_overview(client, db_session):
    headers = get_auth_headers(db_session, "student1@campusshare.demo")
    res = client.get("/analytics/overview", headers=headers)
    assert res.status_code == 403

def test_campus_pulse_telemetry(client, db_session):
    headers = get_auth_headers(db_session, "student1@campusshare.demo")
    res = client.get("/analytics/campus-pulse?hour=14", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["hour"] == 14
    assert "rooms" in data
    assert len(data["rooms"]) == 8
    
    # Verify each room node has paper-map SVG coordinates and heatmap color token
    for r in data["rooms"]:
        assert "map_x" in r and "map_y" in r and "map_w" in r and "map_h" in r
        assert r["color_token"] in ["sage", "fern", "apricot", "persimmon", "mulberry"]
        assert "upcoming_bookings" in r
        assert "status_label" in r

def test_ai_project_buddy_recommendations(client, db_session):
    headers = get_auth_headers(db_session, "student1@campusshare.demo")
    payload = {
        "query": "I am developing a line-following robot for a national robotics competition."
    }
    res = client.post("/ai/recommend", json=payload, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "badge" in data
    assert data["badge"] in ["Smart matching", "AI-assisted"]
    assert "needs" in data
    assert "recommendations" in data
    assert len(data["recommendations"]) > 0

    first_rec = data["recommendations"][0]
    assert "name" in first_rec
    assert "reason" in first_rec
    assert "is_eligible" in first_rec
    assert "is_available" in first_rec

def test_ai_personalized_recommendations(client, db_session):
    headers = get_auth_headers(db_session, "student1@campusshare.demo")
    res = client.get("/ai/recommended-for-you?limit=4", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert len(data) <= 4
    if len(data) > 0:
        assert "name" in data[0]
        assert "category" in data[0]
