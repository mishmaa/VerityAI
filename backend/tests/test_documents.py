from io import BytesIO


def register(client, *, email="owner@example.com", organization="Acme"):
    response = client.post(
        "/api/v1/auth/register",
        json={
            "organization_name": organization,
            "full_name": "Owner User",
            "email": email,
            "password": "strong-password-123",
        },
    )
    return response.json()["access_token"]


def auth(token):
    return {"Authorization": f"Bearer {token}"}


def upload_text(client, token, name="security.txt"):
    content = (
        "The incident response policy requires critical security incidents to be reported "
        "within thirty minutes. The security lead must preserve audit logs and notify legal."
    )
    return client.post(
        "/api/v1/documents",
        headers=auth(token),
        files={"file": (name, BytesIO(content.encode()), "text/plain")},
    )


def test_upload_list_search_and_grounded_answer(client):
    token = register(client)
    uploaded = upload_text(client, token)

    assert uploaded.status_code == 201
    assert uploaded.json()["status"] == "ready"
    assert uploaded.json()["chunk_count"] == 1

    listed = client.get("/api/v1/documents", headers=auth(token))
    assert len(listed.json()) == 1

    searched = client.post(
        "/api/v1/documents/search/query",
        headers=auth(token),
        json={"query": "When must critical incidents be reported?"},
    )
    assert searched.status_code == 200
    assert searched.json()["results"][0]["document_name"] == "security.txt"
    assert searched.json()["results"][0]["page_number"] == 1

    answer = client.post(
        "/api/v1/documents/ask/query",
        headers=auth(token),
        json={"query": "critical security incidents"},
    )
    assert answer.json()["grounded"] is True
    assert answer.json()["citations"]
    assert "thirty minutes" in answer.json()["answer"]

    refused = client.post(
        "/api/v1/documents/ask/query",
        headers=auth(token),
        json={"query": "What is the CEO personal phone number?"},
    )
    assert refused.status_code == 200
    assert refused.json()["grounded"] is False
    assert refused.json()["citations"] == []
    assert "sufficient evidence" in refused.json()["answer"]


def test_duplicate_and_unsupported_uploads_are_rejected(client):
    token = register(client)
    assert upload_text(client, token).status_code == 201
    assert upload_text(client, token, "duplicate.txt").status_code == 409

    unsupported = client.post(
        "/api/v1/documents",
        headers=auth(token),
        files={"file": ("malware.exe", BytesIO(b"not really"), "application/octet-stream")},
    )
    assert unsupported.status_code == 400


def test_documents_are_isolated_between_organizations(client):
    first = register(client, email="first@example.com", organization="First")
    second = register(client, email="second@example.com", organization="Second")
    document_id = upload_text(client, first).json()["id"]

    assert client.get(f"/api/v1/documents/{document_id}", headers=auth(second)).status_code == 404
    search = client.post(
        "/api/v1/documents/search/query",
        headers=auth(second),
        json={"query": "critical incidents"},
    )
    assert search.json()["results"] == []


def test_delete_document(client):
    token = register(client)
    document_id = upload_text(client, token).json()["id"]

    deleted = client.delete(f"/api/v1/documents/{document_id}", headers=auth(token))
    assert deleted.status_code == 204
    assert client.get(f"/api/v1/documents/{document_id}", headers=auth(token)).status_code == 404
