from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from app.core.database import get_db
from app.auth.dependencies import RoleChecker
from app.models.models import User, UserRole
from app.services.video_service import VideoService
from app.schemas.video_schema import (
    VideoProcessRequest, 
    VideoProcessResponse,
    VideoStatusResponse,
    VideoResponse,
    VideoDeleteResponse
)
from typing import List

router = APIRouter(
    prefix="/videos",
    tags=["Video Management"]
)

# Dependency injection
def get_video_service():
    return VideoService()

# RBAC Instances
admin_only = RoleChecker(allowed_roles=[UserRole.ADMIN])
any_user = RoleChecker(allowed_roles=[UserRole.USER, UserRole.ADMIN])


@router.post("", status_code=status.HTTP_201_CREATED, response_model=VideoProcessResponse)
async def process_video(
    request: VideoProcessRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(any_user),
    video_service: VideoService = Depends(get_video_service)
):
    """
    Submit a YouTube video for processing (Indexing).
    Any verified user can submit a video.
    """
    return await video_service.process_video(request=request, db=db)


@router.get("/{video_id}/status", status_code=status.HTTP_200_OK, response_model=VideoStatusResponse)
async def get_video_status(
    video_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(any_user),
    video_service: VideoService = Depends(get_video_service)
):
    """
    Check the processing status of a specific video.
    Used by frontend for loading spinners.
    """
    video_status = await video_service.get_video_status(video_id=video_id, db=db)
    return {"video_id": video_id, "status": video_status}


@router.get("", status_code=status.HTTP_200_OK, response_model=List[VideoResponse])
async def get_all_videos(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(any_user),
    video_service: VideoService = Depends(get_video_service)
):
    """
    Get all processed videos for the Library/Dashboard.
    Any verified user can see the available videos.
    """
    return await video_service.get_all_videos(db=db)


@router.post("/{video_id}/reprocess", status_code=status.HTTP_200_OK, response_model=VideoProcessResponse)
async def reprocess_video(
    video_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(admin_only),  # ADMIN ONLY
    video_service: VideoService = Depends(get_video_service)
):
    """
    Reprocess a FAILED video.
    Only ADMINS can trigger reprocessing.
    """
    return await video_service.reprocess_video(video_id=video_id, db=db)


@router.delete("/{video_id}", status_code=status.HTTP_200_OK, response_model=VideoDeleteResponse)
async def delete_video(
    video_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(admin_only),  # ADMIN ONLY
    video_service: VideoService = Depends(get_video_service)
):
    """
    Delete a video from database and Qdrant.
    Only ADMINS can delete videos to prevent breaking other users' chats.
    """
    await video_service.delete_video(video_id=video_id, db=db)
    return {"message": "Video deleted successfully from Database and Qdrant"}
