from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func, select

from app.api.dependencies import CurrentUser, DbSession
from app.models import Collection, CollectionDocument, KnowledgeDocument
from app.schemas.collections import CollectionCreate, CollectionResponse, CollectionUpdate
from app.services.audit import record_audit

router = APIRouter(prefix="/collections", tags=["collections"])


def get_collection_or_404(db: DbSession, collection_id: UUID, organization_id: UUID) -> Collection:
    collection = db.scalar(
        select(Collection).where(
            Collection.id == collection_id,
            Collection.organization_id == organization_id,
        )
    )
    if collection is None:
        raise HTTPException(status_code=404, detail="Collection not found")
    return collection


def serialize_collection(db: DbSession, collection: Collection) -> CollectionResponse:
    document_ids = list(
        db.scalars(
            select(CollectionDocument.document_id).where(
                CollectionDocument.collection_id == collection.id
            )
        )
    )
    return CollectionResponse(
        id=collection.id,
        name=collection.name,
        description=collection.description,
        color=collection.color,
        document_count=len(document_ids),
        document_ids=document_ids,
        created_at=collection.created_at,
    )


@router.get("", response_model=list[CollectionResponse])
def list_collections(db: DbSession, current_user: CurrentUser) -> list[CollectionResponse]:
    collections = db.scalars(
        select(Collection)
        .where(Collection.organization_id == current_user.organization_id)
        .order_by(Collection.created_at.desc())
    )
    return [serialize_collection(db, collection) for collection in collections]


@router.post("", response_model=CollectionResponse, status_code=status.HTTP_201_CREATED)
def create_collection(
    payload: CollectionCreate, db: DbSession, current_user: CurrentUser
) -> CollectionResponse:
    duplicate = db.scalar(
        select(func.count())
        .select_from(Collection)
        .where(
            Collection.organization_id == current_user.organization_id,
            func.lower(Collection.name) == payload.name.strip().lower(),
        )
    )
    if duplicate:
        raise HTTPException(status_code=409, detail="A collection with this name already exists")
    collection = Collection(
        organization_id=current_user.organization_id,
        created_by_id=current_user.id,
        name=payload.name.strip(),
        description=payload.description.strip(),
        color=payload.color,
    )
    db.add(collection)
    db.flush()
    record_audit(
        db,
        organization_id=current_user.organization_id,
        actor_id=current_user.id,
        action="collection.created",
        resource_type="collection",
        resource_id=collection.id,
        metadata={"name": collection.name},
    )
    db.commit()
    db.refresh(collection)
    return serialize_collection(db, collection)


@router.patch("/{collection_id}", response_model=CollectionResponse)
def update_collection(
    collection_id: UUID,
    payload: CollectionUpdate,
    db: DbSession,
    current_user: CurrentUser,
) -> CollectionResponse:
    collection = get_collection_or_404(db, collection_id, current_user.organization_id)
    collection.name = payload.name.strip()
    collection.description = payload.description.strip()
    collection.color = payload.color
    record_audit(
        db,
        organization_id=current_user.organization_id,
        actor_id=current_user.id,
        action="collection.updated",
        resource_type="collection",
        resource_id=collection.id,
        metadata={"name": collection.name},
    )
    db.commit()
    db.refresh(collection)
    return serialize_collection(db, collection)


@router.delete("/{collection_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_collection(collection_id: UUID, db: DbSession, current_user: CurrentUser) -> None:
    collection = get_collection_or_404(db, collection_id, current_user.organization_id)
    record_audit(
        db,
        organization_id=current_user.organization_id,
        actor_id=current_user.id,
        action="collection.deleted",
        resource_type="collection",
        resource_id=collection.id,
        metadata={"name": collection.name},
    )
    db.delete(collection)
    db.commit()


@router.put("/{collection_id}/documents/{document_id}", response_model=CollectionResponse)
def add_document(
    collection_id: UUID, document_id: UUID, db: DbSession, current_user: CurrentUser
) -> CollectionResponse:
    collection = get_collection_or_404(db, collection_id, current_user.organization_id)
    document = db.scalar(
        select(KnowledgeDocument).where(
            KnowledgeDocument.id == document_id,
            KnowledgeDocument.organization_id == current_user.organization_id,
        )
    )
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found")
    link = db.get(CollectionDocument, (collection_id, document_id))
    if link is None:
        db.add(CollectionDocument(collection_id=collection_id, document_id=document_id))
        record_audit(
            db,
            organization_id=current_user.organization_id,
            actor_id=current_user.id,
            action="collection.document_added",
            resource_type="collection",
            resource_id=collection.id,
            metadata={"collection": collection.name, "document": document.name},
        )
        db.commit()
    return serialize_collection(db, collection)


@router.delete("/{collection_id}/documents/{document_id}", response_model=CollectionResponse)
def remove_document(
    collection_id: UUID, document_id: UUID, db: DbSession, current_user: CurrentUser
) -> CollectionResponse:
    collection = get_collection_or_404(db, collection_id, current_user.organization_id)
    link = db.get(CollectionDocument, (collection_id, document_id))
    if link is not None:
        db.delete(link)
        db.commit()
    return serialize_collection(db, collection)
