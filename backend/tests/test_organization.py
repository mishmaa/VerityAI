def register(client, email="owner@acme.com", organization="Acme"):
    response = client.post(
        "/api/v1/auth/register",
        json={
            "organization_name": organization,
            "full_name": "Workspace Owner",
            "email": email,
            "password": "strong-password-123",
        },
    )
    return response.json()["access_token"]


def test_organization_overview_members_and_activity(client):
    token = register(client)
    headers = {"Authorization": f"Bearer {token}"}

    overview = client.get("/api/v1/organization/overview", headers=headers)
    assert overview.status_code == 200
    assert overview.json()["name"] == "Acme"
    assert overview.json()["member_count"] == 1

    members = client.get("/api/v1/organization/members", headers=headers)
    assert members.status_code == 200
    assert members.json()[0]["role"] == "owner"

    activity = client.get("/api/v1/organization/activity", headers=headers)
    assert activity.status_code == 200
    assert activity.json()[0]["action"] == "organization.created"


def test_organization_data_is_tenant_scoped(client):
    first = register(client, "first@example.com", "First")
    second = register(client, "second@example.com", "Second")

    first_data = client.get(
        "/api/v1/organization/overview", headers={"Authorization": f"Bearer {first}"}
    ).json()
    second_data = client.get(
        "/api/v1/organization/overview", headers={"Authorization": f"Bearer {second}"}
    ).json()
    assert first_data["name"] == "First"
    assert second_data["name"] == "Second"


def test_settings_profile_password_and_invitation_workflows(client):
    token = register(client)
    headers = {"Authorization": f"Bearer {token}"}

    renamed = client.patch(
        "/api/v1/organization", headers=headers, json={"name": "Acme Intelligence"}
    )
    assert renamed.status_code == 200
    assert renamed.json()["name"] == "Acme Intelligence"

    profile = client.patch("/api/v1/auth/me", headers=headers, json={"full_name": "Updated Owner"})
    assert profile.status_code == 200
    assert profile.json()["full_name"] == "Updated Owner"

    invitation = client.post(
        "/api/v1/organization/invitations",
        headers=headers,
        json={"email": "teammate@example.com", "role": "member"},
    )
    assert invitation.status_code == 201
    invitations = client.get("/api/v1/organization/invitations", headers=headers)
    assert invitations.json()[0]["email"] == "teammate@example.com"
    revoked = client.delete(
        f"/api/v1/organization/invitations/{invitation.json()['id']}", headers=headers
    )
    assert revoked.status_code == 204

    changed = client.post(
        "/api/v1/auth/change-password",
        headers=headers,
        json={
            "current_password": "strong-password-123",
            "new_password": "new-strong-password-456",
        },
    )
    assert changed.status_code == 204
    login = client.post(
        "/api/v1/auth/login",
        data={"username": "owner@acme.com", "password": "new-strong-password-456"},
    )
    assert login.status_code == 200
