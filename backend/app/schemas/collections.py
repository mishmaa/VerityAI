from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class CollectionCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    description: str = Field(default="", max_length=500)
    color: str = Field(default="sage", pattern="^(sage|blue|amber|violet|rose)$")


class CollectionUpdate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    description: str = Field(default="", max_length=500)
    color: str = Field(default="sage", pattern="^(sage|blue|amber|violet|rose)$")


class CollectionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    description: str
    color: str
    document_count: int
    document_ids: list[UUID]
    created_at: datetime
