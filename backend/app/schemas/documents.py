from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models import DocumentStatus


class DocumentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    content_type: str
    size_bytes: int
    status: DocumentStatus
    page_count: int
    chunk_count: int
    error_message: str | None
    created_at: datetime


class SearchRequest(BaseModel):
    query: str = Field(min_length=2, max_length=500)
    limit: int = Field(default=5, ge=1, le=20)
    document_ids: list[UUID] | None = None


class Citation(BaseModel):
    document_id: UUID
    document_name: str
    page_number: int | None
    chunk_id: UUID
    excerpt: str
    score: float


class SearchResponse(BaseModel):
    query: str
    results: list[Citation]


class AskRequest(SearchRequest):
    pass


class GroundedAnswer(BaseModel):
    answer: str
    citations: list[Citation]
    grounded: bool
