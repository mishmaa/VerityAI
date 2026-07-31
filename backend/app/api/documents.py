from pathlib import Path
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, File, HTTPException, UploadFile, status
from sqlalchemy import select

from app.api.dependencies import CurrentUser, DbSession
from app.models import KnowledgeDocument
from app.schemas.documents import (
    AskRequest,
    DocumentResponse,
    GroundedAnswer,
    SearchRequest,
    SearchResponse,
)
from app.services.audit import record_audit
from app.services.documents import (
    InvalidDocument,
    compose_grounded_answer,
    process_document,
    remove_stored_document,
    safe_filename,
    search_documents,
    store_upload,
)

router = APIRouter(prefix="/documents", tags=["documents"])


@router.post("", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
def upload_document(
    db: DbSession,
    current_user: CurrentUser,
    file: Annotated[UploadFile, File()],
) -> KnowledgeDocument:
    try:
        storage_key, size, digest = store_upload(file, current_user.organization_id)
    except InvalidDocument as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from None

    existing = db.scalar(
        select(KnowledgeDocument).where(
            KnowledgeDocument.organization_id == current_user.organization_id,
            KnowledgeDocument.sha256 == digest,
        )
    )
    if existing:
        Path(storage_key).unlink(missing_ok=True)
        raise HTTPException(status_code=409, detail="This document has already been uploaded")

    document = KnowledgeDocument(
        organization_id=current_user.organization_id,
        uploaded_by_id=current_user.id,
        name=safe_filename(file.filename),
        storage_key=storage_key,
        content_type=(file.content_type or "application/octet-stream").lower(),
        sha256=digest,
        size_bytes=size,
    )
    db.add(document)
    db.commit()
    db.refresh(document)
    processed = process_document(db, document)
    record_audit(
        db,
        organization_id=current_user.organization_id,
        actor_id=current_user.id,
        action="document.uploaded",
        resource_type="document",
        resource_id=processed.id,
        metadata={"name": processed.name, "status": processed.status.value},
    )
    db.commit()
    db.refresh(processed)
    return processed


@router.get("", response_model=list[DocumentResponse])
def list_documents(db: DbSession, current_user: CurrentUser) -> list[KnowledgeDocument]:
    return list(
        db.scalars(
            select(KnowledgeDocument)
            .where(KnowledgeDocument.organization_id == current_user.organization_id)
            .order_by(KnowledgeDocument.created_at.desc())
        )
    )


@router.get("/{document_id}", response_model=DocumentResponse)
def get_document(document_id: UUID, db: DbSession, current_user: CurrentUser):
    document = db.scalar(
        select(KnowledgeDocument).where(
            KnowledgeDocument.id == document_id,
            KnowledgeDocument.organization_id == current_user.organization_id,
        )
    )
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found")
    return document


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(document_id: UUID, db: DbSession, current_user: CurrentUser) -> None:
    document = db.scalar(
        select(KnowledgeDocument).where(
            KnowledgeDocument.id == document_id,
            KnowledgeDocument.organization_id == current_user.organization_id,
        )
    )
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found")
    record_audit(
        db,
        organization_id=current_user.organization_id,
        actor_id=current_user.id,
        action="document.deleted",
        resource_type="document",
        resource_id=document.id,
        metadata={"name": document.name},
    )
    remove_stored_document(document)
    db.delete(document)
    db.commit()


@router.post("/search/query", response_model=SearchResponse)
def search(payload: SearchRequest, db: DbSession, current_user: CurrentUser) -> SearchResponse:
    results = search_documents(
        db,
        organization_id=current_user.organization_id,
        query=payload.query,
        limit=payload.limit,
        document_ids=payload.document_ids,
    )
    return SearchResponse(query=payload.query, results=results)


@router.post("/ask/query", response_model=GroundedAnswer)
def ask(payload: AskRequest, db: DbSession, current_user: CurrentUser) -> GroundedAnswer:
    citations = search_documents(
        db,
        organization_id=current_user.organization_id,
        query=payload.query,
        limit=min(payload.limit, 5),
        document_ids=payload.document_ids,
    )
    citations = [citation for citation in citations if citation.score >= 0.35]
    if not citations:
        return GroundedAnswer(
            answer="I could not find sufficient evidence in the authorized knowledge base.",
            citations=[],
            grounded=False,
        )
    answer = compose_grounded_answer(payload.query, citations)
    record_audit(
        db,
        organization_id=current_user.organization_id,
        actor_id=current_user.id,
        action="knowledge.queried",
        resource_type="knowledge_base",
        metadata={"citation_count": len(citations), "grounded": True},
    )
    db.commit()
    return GroundedAnswer(answer=answer, citations=citations, grounded=True)
