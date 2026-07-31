from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models import UserRole


class OrganizationOverview(BaseModel):
    id: UUID
    name: str
    slug: str
    member_count: int
    document_count: int
    passage_count: int


class MemberResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    full_name: str
    email: EmailStr
    role: UserRole
    is_active: bool
    created_at: datetime


class AuditEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    actor_id: UUID | None
    action: str
    resource_type: str
    resource_id: str | None
    event_metadata: dict[str, object]
    created_at: datetime


class OrganizationUpdate(BaseModel):
    name: str = Field(min_length=2, max_length=120)


class InvitationCreate(BaseModel):
    email: EmailStr
    role: UserRole = UserRole.member


class InvitationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: EmailStr
    role: UserRole
    status: str
    created_at: datetime
