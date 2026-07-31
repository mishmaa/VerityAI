from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, select

from app.api.dependencies import CurrentUser, DbSession
from app.models import (
    AuditEvent,
    DocumentChunk,
    Invitation,
    KnowledgeDocument,
    Organization,
    User,
    UserRole,
)
from app.schemas.organization import (
    AuditEventResponse,
    InvitationCreate,
    InvitationResponse,
    MemberResponse,
    OrganizationOverview,
    OrganizationUpdate,
)
from app.services.audit import record_audit

router = APIRouter(prefix="/organization", tags=["organization"])


def require_admin(user: User) -> None:
    if user.role not in {UserRole.owner, UserRole.admin}:
        raise HTTPException(status_code=403, detail="Administrator access is required")


@router.get("/overview", response_model=OrganizationOverview)
def overview(db: DbSession, current_user: CurrentUser) -> OrganizationOverview:
    organization = db.get(Organization, current_user.organization_id)
    member_count = db.scalar(
        select(func.count())
        .select_from(User)
        .where(User.organization_id == current_user.organization_id)
    )
    document_count = db.scalar(
        select(func.count())
        .select_from(KnowledgeDocument)
        .where(KnowledgeDocument.organization_id == current_user.organization_id)
    )
    passage_count = db.scalar(
        select(func.count())
        .select_from(DocumentChunk)
        .where(DocumentChunk.organization_id == current_user.organization_id)
    )
    return OrganizationOverview(
        id=organization.id,
        name=organization.name,
        slug=organization.slug,
        member_count=member_count or 0,
        document_count=document_count or 0,
        passage_count=passage_count or 0,
    )


@router.patch("", response_model=OrganizationOverview)
def update_organization(
    payload: OrganizationUpdate, db: DbSession, current_user: CurrentUser
) -> OrganizationOverview:
    require_admin(current_user)
    organization = db.get(Organization, current_user.organization_id)
    organization.name = payload.name.strip()
    record_audit(
        db,
        organization_id=current_user.organization_id,
        actor_id=current_user.id,
        action="organization.updated",
        resource_type="organization",
        resource_id=organization.id,
        metadata={"name": organization.name},
    )
    db.commit()
    return overview(db, current_user)


@router.get("/members", response_model=list[MemberResponse])
def members(db: DbSession, current_user: CurrentUser) -> list[User]:
    return list(
        db.scalars(
            select(User)
            .where(User.organization_id == current_user.organization_id)
            .order_by(User.created_at)
        )
    )


@router.get("/activity", response_model=list[AuditEventResponse])
def activity(
    db: DbSession,
    current_user: CurrentUser,
    limit: int = Query(default=50, ge=1, le=200),
) -> list[AuditEvent]:
    return list(
        db.scalars(
            select(AuditEvent)
            .where(AuditEvent.organization_id == current_user.organization_id)
            .order_by(AuditEvent.created_at.desc())
            .limit(limit)
        )
    )


@router.get("/invitations", response_model=list[InvitationResponse])
def invitations(db: DbSession, current_user: CurrentUser) -> list[Invitation]:
    require_admin(current_user)
    return list(
        db.scalars(
            select(Invitation)
            .where(Invitation.organization_id == current_user.organization_id)
            .order_by(Invitation.created_at.desc())
        )
    )


@router.post("/invitations", response_model=InvitationResponse, status_code=status.HTTP_201_CREATED)
def create_invitation(
    payload: InvitationCreate, db: DbSession, current_user: CurrentUser
) -> Invitation:
    require_admin(current_user)
    email = payload.email.lower()
    existing_user = db.scalar(select(User).where(User.email == email))
    if existing_user:
        raise HTTPException(status_code=409, detail="This email already belongs to an account")
    existing_invitation = db.scalar(
        select(Invitation).where(
            Invitation.organization_id == current_user.organization_id,
            Invitation.email == email,
            Invitation.status == "pending",
        )
    )
    if existing_invitation:
        raise HTTPException(status_code=409, detail="A pending invitation already exists")
    invitation = Invitation(
        organization_id=current_user.organization_id,
        invited_by_id=current_user.id,
        email=email,
        role=payload.role,
    )
    db.add(invitation)
    db.flush()
    record_audit(
        db,
        organization_id=current_user.organization_id,
        actor_id=current_user.id,
        action="invitation.created",
        resource_type="invitation",
        resource_id=invitation.id,
        metadata={"email": email, "role": payload.role.value},
    )
    db.commit()
    db.refresh(invitation)
    return invitation


@router.delete("/invitations/{invitation_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_invitation(invitation_id: UUID, db: DbSession, current_user: CurrentUser) -> None:
    require_admin(current_user)
    invitation = db.scalar(
        select(Invitation).where(
            Invitation.id == invitation_id,
            Invitation.organization_id == current_user.organization_id,
        )
    )
    if invitation is None:
        raise HTTPException(status_code=404, detail="Invitation not found")
    record_audit(
        db,
        organization_id=current_user.organization_id,
        actor_id=current_user.id,
        action="invitation.revoked",
        resource_type="invitation",
        resource_id=invitation.id,
        metadata={"email": invitation.email},
    )
    db.delete(invitation)
    db.commit()
