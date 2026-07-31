def registration_payload(**overrides):
    data = {
        "organization_name": "Northstar Legal",
        "full_name": "Amina Shah",
        "email": "amina@example.com",
        "password": "a-strong-password",
    }
    data.update(overrides)
    return data


def test_register_creates_owner_and_returns_token(client):
    response = client.post("/api/v1/auth/register", json=registration_payload())

    assert response.status_code == 201
    body = response.json()
    assert body["access_token"]
    assert body["user"]["email"] == "amina@example.com"
    assert body["user"]["role"] == "owner"


def test_duplicate_email_is_rejected(client):
    client.post("/api/v1/auth/register", json=registration_payload())
    response = client.post("/api/v1/auth/register", json=registration_payload())

    assert response.status_code == 409


def test_login_and_current_user(client):
    client.post("/api/v1/auth/register", json=registration_payload())
    login = client.post(
        "/api/v1/auth/login",
        data={"username": "amina@example.com", "password": "a-strong-password"},
    )

    assert login.status_code == 200
    token = login.json()["access_token"]
    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["full_name"] == "Amina Shah"


def test_protected_endpoint_rejects_missing_token(client):
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401


def test_health_and_readiness(client):
    assert client.get("/health").json()["status"] == "healthy"
    assert client.get("/ready").json()["status"] == "ready"
