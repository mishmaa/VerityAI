from fastapi import APIRouter

from app.api import auth, collections, documents, organization

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(documents.router)
api_router.include_router(organization.router)
api_router.include_router(collections.router)
