import pytest
from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.devices.models import Device
from apps.sensors.models import SensorReading

User = get_user_model()


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def user(db):
    return User.objects.create_user(username="alice", email="alice@example.com", password="Secret123!")


@pytest.mark.django_db
def test_home_and_api_index(api):
    r = api.get("/")
    assert r.status_code == 200
    assert r["Content-Type"].startswith("text/html")
    assert b"Apex Sensor Studio" in r.content
    assert f'href="{settings.FRONTEND_URL}/?auth=signup"'.encode() in r.content
    assert f'href="{settings.FRONTEND_URL}/?view=analytics"'.encode() in r.content
    assert b'href="/api/' not in r.content

    r = api.get("/api/")
    assert r.status_code == 200
    assert r.json() == {
        "auth": {
            "csrf": "/api/auth/csrf/",
            "signup": "/api/auth/signup/",
            "login": "/api/auth/login/",
            "refresh": "/api/auth/refresh/",
            "logout": "/api/auth/logout/",
        },
        "devices": "/api/devices/",
        "readings": "/api/sensors/readings/",
        "analytics": "/api/sensors/analytics/",
    }


@pytest.mark.django_db
def test_signup_login_refresh_flow(api):
    r = api.get("/api/auth/csrf/")
    assert r.status_code == 200
    assert "csrfToken" in r.json()

    r = api.post(
        "/api/auth/signup/",
        {"email": "bob@example.com", "password": "Secret123!", "confirm_password": "Secret123!"},
        format="json",
    )
    assert r.status_code == 201
    body = r.json()
    assert "access" in body
    assert body["user"]["email"] == "bob@example.com"

    r = api.post(
        "/api/auth/login/",
        {"email": "bob@example.com", "password": "Secret123!"},
        format="json",
    )
    assert r.status_code == 200
    assert "access" in r.json()


@pytest.mark.django_db
def test_device_registration_and_ingest(api, user):
    api.force_authenticate(user=user)
    r = api.post("/api/devices/", {"name": "Greenhouse"}, format="json")
    assert r.status_code == 201
    data = r.json()
    device_id = data["device_id"]
    token = data["token"]

    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}", HTTP_X_DEVICE_ID=device_id)
    r = client.post("/api/sensors/readings/", {"moisture": 42.5}, format="json")
    assert r.status_code == 201
    assert SensorReading.objects.count() == 1

    r = api.get("/api/sensors/readings/")
    assert r.status_code == 200
    rows = r.json()
    assert len(rows) == 1
    assert rows[0]["moisturereading"] == 42.5


@pytest.mark.django_db
def test_analytics_summary(api, user):
    device = Device.objects.create(owner=user, name="Plot A")
    SensorReading.objects.create(device=device, moisture=30.0)
    SensorReading.objects.create(device=device, moisture=50.0)

    r = api.get("/api/sensors/analytics/")
    assert r.status_code == 200
    body = r.json()
    assert body["sample_count"] == 2
    assert body["moisture"]["avg"] == 40.0
    assert body["moisture"]["min"] == 30.0
    assert body["moisture"]["max"] == 50.0
