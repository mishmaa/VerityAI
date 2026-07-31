from io import BytesIO


def register(client, email="owner.collections@example.com", organization="Collections Co"):
    response = client.post(
        "/api/v1/auth/register",
        json={
            "organization_name": organization,
            "full_name": "Collection Owner",
            "email": email,
            "password": "strong-password-123",
        },
    )
    return response.json()["access_token"]


def headers(token):
    return {"Authorization": f"Bearer {token}"}


def upload(client, token):
    response = client.post(
        "/api/v1/documents",
        headers=headers(token),
        files={
            "file": (
                "handbook.txt",
                BytesIO(b"Remote work requests require manager approval and security review."),
                "text/plain",
            )
        },
    )
    return response.json()


def test_collection_lifecycle_and_document_assignment(client):
    token = register(client)
    document = upload(client, token)
    created = client.post(
        "/api/v1/collections",
        headers=headers(token),
        json={"name": "People Ops", "description": "Team policies", "color": "blue"},
    )
    assert created.status_code == 201
    collection = created.json()
    assert collection["document_count"] == 0

    assigned = client.put(
        f"/api/v1/collections/{collection['id']}/documents/{document['id']}",
        headers=headers(token),
    )
    assert assigned.status_code == 200
    assert assigned.json()["document_ids"] == [document["id"]]

    listed = client.get("/api/v1/collections", headers=headers(token)).json()
    assert listed[0]["document_count"] == 1

    removed = client.delete(
        f"/api/v1/collections/{collection['id']}/documents/{document['id']}",
        headers=headers(token),
    )
    assert removed.status_code == 200
    assert removed.json()["document_count"] == 0

    deleted = client.delete(f"/api/v1/collections/{collection['id']}", headers=headers(token))
    assert deleted.status_code == 204


def test_duplicate_collection_and_tenant_access_are_rejected(client):
    first = register(client, "first.collections@example.com", "First Collections")
    second = register(client, "second.collections@example.com", "Second Collections")
    created = client.post(
        "/api/v1/collections",
        headers=headers(first),
        json={"name": "Legal", "description": "", "color": "sage"},
    )
    duplicate = client.post(
        "/api/v1/collections",
        headers=headers(first),
        json={"name": "legal", "description": "", "color": "sage"},
    )
    assert duplicate.status_code == 409
    inaccessible = client.delete(
        f"/api/v1/collections/{created.json()['id']}", headers=headers(second)
    )
    assert inaccessible.status_code == 404
