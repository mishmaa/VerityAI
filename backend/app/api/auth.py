import re
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.api.dependencies import CurrentUser, DbSession
from app.core.security import create_access_token, hash_password, verify_password
from app.models import Organization, User, UserRole
from app.schemas.auth import (
    PasswordChange,
    ProfileUpdate,
    RegisterRequest,
    TokenResponse,
    UserResponse,
)
from app.services.audit import record_audit

router = APIRouter(prefix="/auth", tags=["authentication"])


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "organization"


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: DbSession) -> TokenResponse:
    email = payload.email.lower()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status_code=409, detail="An account with this email already exists")

    base_slug = slugify(payload.organization_name)
    slug = base_slug
    suffix = 2
    while db.scalar(select(Organization).where(Organization.slug == slug)):
        slug = f"{base_slug}-{suffix}"
        suffix += 1

    organization = Organization(name=payload.organization_name.strip(), slug=slug)
    user = User(
        organization=organization,
        email=email,
        full_name=payload.full_name.strip(),
        hashed_password=hash_password(payload.password),
        role=UserRole.owner,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Account could not be created") from None
    db.refresh(user)
    record_audit(
        db,
        organization_id=user.organization_id,
        actor_id=user.id,
        action="organization.created",
        resource_type="organization",
        resource_id=organization.id,
    )
    db.commit()

    token = create_access_token(
        user_id=user.id, organization_id=user.organization_id, role=user.role.value
    )
    return TokenResponse(access_token=token, user=UserResponse.model_validate(user))


@router.post("/login", response_model=TokenResponse)
def login(form: Annotated[OAuth2PasswordRequestForm, Depends()], db: DbSession) -> TokenResponse:
    user = db.scalar(select(User).where(User.email == form.username.lower()))
    if user is None or not verify_password(form.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled")

    record_audit(
        db,
        organization_id=user.organization_id,
        actor_id=user.id,
        action="user.signed_in",
        resource_type="user",
        resource_id=user.id,
    )
    db.commit()

    token = create_access_token(
        user_id=user.id, organization_id=user.organization_id, role=user.role.value
    )
    return TokenResponse(access_token=token, user=UserResponse.model_validate(user))


@router.get("/me", response_model=UserResponse)
def me(current_user: CurrentUser) -> User:
    return current_user


@router.patch("/me", response_model=UserResponse)
def update_profile(payload: ProfileUpdate, db: DbSession, current_user: CurrentUser) -> User:
    current_user.full_name = payload.full_name.strip()
    record_audit(
        db,
        organization_id=current_user.organization_id,
        actor_id=current_user.id,
        action="user.profile_updated",
        resource_type="user",
        resource_id=current_user.id,
    )
    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(payload: PasswordChange, db: DbSession, current_user: CurrentUser) -> None:
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    current_user.hashed_password = hash_password(payload.new_password)
    record_audit(
        db,
        organization_id=current_user.organization_id,
        actor_id=current_user.id,
        action="user.password_changed",
        resource_type="user",
        resource_id=current_user.id,
    )
    db.commit()
