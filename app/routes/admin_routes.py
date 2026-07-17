from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from typing import List

from app.core.database import get_db
from app.auth.dependencies import RoleChecker
from app.models.models import User, UserRole
from app.services.admin_service import AdminService
from app.schemas.admin_schema import (
    AdminUserResponse,
    AdminUserUpdateSchema,
    SystemStatsResponse,
    AdminVideoResponse
)
from app.schemas.video_schema import VideoProcessResponse

router = APIRouter(
    prefix="/admin",
    tags=["Admin Management"]
)

# RBAC Verification dependency - strictly Admins only
admin_only = RoleChecker(allowed_roles=[UserRole.ADMIN])

# --- User Management ---

@router.get("/users", response_model=List[AdminUserResponse], status_code=status.HTTP_200_OK)
async def list_all_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(admin_only)
):
    """
    Get a list of all registered users. Only accessible by admins.
    """
    return await AdminService.get_all_users(db)

@router.patch("/users/{user_id}/role", status_code=status.HTTP_200_OK)
async def update_user_role(
    user_id: UUID,
    payload: AdminUserUpdateSchema,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(admin_only)
):
    """
    Change a user's role (e.g. promoting a user to admin).
    """
    return await AdminService.update_role(user_id=user_id, role=payload.role, db=db)

@router.delete("/users/{user_id}", status_code=status.HTTP_200_OK)
async def delete_user(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(admin_only)
):
    """
    Delete a user and cascade delete their conversations/messages.
    """
    return await AdminService.delete_user(user_id=user_id, db=db)

# --- Video Moderation & Controls ---

@router.get("/videos", response_model=List[AdminVideoResponse], status_code=status.HTTP_200_OK)
async def list_all_videos(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(admin_only)
):
    """
    Get a list of all videos indexed in the system.
    """
    return await AdminService.get_all_videos(db)

@router.delete("/videos/{video_id}", status_code=status.HTTP_200_OK)
async def delete_video(
    video_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(admin_only)
):
    """
    Purge a video from the database and delete its embeddings from Qdrant.
    """
    return await AdminService.delete_video(video_id=video_id, db=db)

@router.post("/videos/{video_id}/reprocess", response_model=VideoProcessResponse, status_code=status.HTTP_200_OK)
async def reprocess_video(
    video_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(admin_only)
):
    """
    Force restart the background indexing task for a video.
    """
    return await AdminService.reprocess_video(video_id=video_id, db=db)

# --- Analytics Stats ---

@router.get("/stats", response_model=SystemStatsResponse, status_code=status.HTTP_200_OK)
async def get_system_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(admin_only)
):
    """
    Get general analytics regarding total users, videos, and chats.
    """
    return await AdminService.get_stats(db)
