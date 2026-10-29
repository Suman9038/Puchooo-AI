from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logger import logger
from app.models.models import Video, VideoStatus
from app.repositories.video_repository import VideoRepository
from app.schemas.video_schema import VideoProcessRequest, VideoProcessResponse
from app.utils.youtube import YoutubeUtils
from app.worker.celery import index_video_task
from app.core.exceptions import (
    InvalidYoutubeURL,
    VideoNotFound,
)
from app.rag_pipeline.vector_store import QdrantService


class VideoService:
    """
    Handles all business logic related to YouTube videos.

    Responsibilities:
    - Validate YouTube URLs
    - Prevent duplicate video processing
    - Create video records
    - Trigger background indexing
    - Fetch video details
    """

    def __init__(
        self,
        video_repository: VideoRepository | None = None,
        qdrant_service: QdrantService | None = None,
    ) -> None:
        self.video_repo = video_repository or VideoRepository()
        self.qdrant_service = qdrant_service or QdrantService()

    async def process_video(
        self,
        request: VideoProcessRequest,
        db: AsyncSession,
    ) -> VideoProcessResponse:
        """
        Process a YouTube video.

        Workflow
        --------
        1. Validate URL
        2. Extract YouTube Video ID
        3. Check if already exists
        4. If READY -> return existing
        5. Else create video
        6. Trigger Celery indexing
        7. Return response
        """

        youtube_url = str(request.video_url).strip()

        if not YoutubeUtils.is_valid_youtube_url(youtube_url):
            raise InvalidYoutubeURL()
    
        youtube_video_id = YoutubeUtils.extract_video_id(youtube_url)

        logger.info(
            "Processing video | youtube_video_id=%s",
            youtube_video_id,
        )

        existing_video = await self.video_repo.get_by_youtube_video_id(
            youtube_video_id=youtube_video_id,
            db=db,
        )

        if existing_video:

            logger.info(
                "Video already exists | youtube_video_id=%s | status=%s",
                existing_video.youtube_video_id,
                existing_video.status,
            )

            # Trigger indexing again only if previous attempt failed
            if existing_video.status == VideoStatus.FAILED:

                await self.video_repo.update_status(
                    existing_video,
                    VideoStatus.PENDING,
                    db,
                )

                index_video_task.delay(str(existing_video.id))
                message = "Video indexing failed previously, retrying now."
                current_status = VideoStatus.PENDING

            elif existing_video.status == VideoStatus.PROCESSING or existing_video.status == VideoStatus.PENDING:
                message = "Video is currently being indexed."
                current_status = existing_video.status

            elif existing_video.status == VideoStatus.READY:
                message = "Video already indexed."
                current_status = VideoStatus.READY
                
            else:
                message = "Video already exists."
                current_status = existing_video.status

            return VideoProcessResponse(
                video_id=existing_video.id,
                yt_video_id=existing_video.youtube_video_id,
                status=current_status,
                message=message,
                title=existing_video.title,
                thumbnail_url=existing_video.thumbnail_url
            )

        # Fetch metadata from YouTube oEmbed API
        metadata = YoutubeUtils.get_video_metadata(youtube_url)

        video = await self.video_repo.create_video(
            youtube_video_id=youtube_video_id,
            youtube_url=youtube_url,
            db=db,
            title=metadata.get("title"),
            thumbnail_url=metadata.get("thumbnail_url")
        )

        logger.info(
            "Dispatching indexing task | video_id=%s",
            video.id,
        )

        index_video_task.delay(str(video.id))

        return VideoProcessResponse(
            video_id=video.id,
            yt_video_id=video.youtube_video_id,
            status=video.status,
            message="Video submitted for indexing.",
            title=video.title,
            thumbnail_url=video.thumbnail_url
        )

    async def get_video(
        self,
        video_id: UUID,
        db: AsyncSession,
    ) -> Video:
        """
        Fetch a video using database UUID.
        """

        video = await self.video_repo.get_by_video_id(
            video_id=video_id,
            db=db,
        )

        if not video:
            raise VideoNotFound()

        return video

    async def get_all_videos(
        self,
        db: AsyncSession,
    ) -> list[Video]:
        """
        Fetch all processed videos.

        Mainly useful for:
        - Admin Dashboard
        - Monitoring
        - Future Analytics
        """

        logger.info("Fetching all videos")

        return await self.video_repo.get_all_videos(db)


    async def delete_video(
        self,
        video_id: UUID,
        db: AsyncSession,
    ) -> dict:
        """
        Delete a video from database and Qdrant vector store.
        """

        video = await self.get_video(
            video_id=video_id,
            db=db,
        )

        try:
            if video.youtube_video_id:
                self.qdrant_service.delete_video_documents(str(video.youtube_video_id))
            self.qdrant_service.delete_video_documents(str(video.id))
            logger.info("Qdrant vectors deleted for video=%s (yt_id=%s)", video.id, video.youtube_video_id)
        except Exception as e:
            logger.warning("Failed to delete Qdrant vectors for video=%s: %s", video.id, e)

        await self.video_repo.delete_video(
            video,
            db,
        )

        logger.info(
            "Video deleted successfully | video_id=%s",
            video.id,
        )

        return {
            "message": "Video deleted successfully."
        }


    async def reprocess_video(
        self,
        video_id: UUID,
        db: AsyncSession,
    ) -> VideoProcessResponse:
        """
        Re-index an already existing video.

        Useful when:
        - Previous indexing failed
        - Embedding model changed
        - Chunking strategy changed
        """

        video = await self.get_video(
            video_id=video_id,
            db=db,
        )

        await self.video_repo.update_status(
            video,
            VideoStatus.PENDING,
            db,
        )

        logger.info(
            "Reprocessing video | video_id=%s",
            video.id,
        )

        index_video_task.delay(str(video.id))

        return VideoProcessResponse(
            video_id=video.id,
            yt_video_id=video.youtube_video_id,
            status=VideoStatus.PENDING,
            message="Video queued for re-indexing.",
            title=video.title,
            thumbnail_url=video.thumbnail_url
        )


    async def get_video_status(
        self,
        video_id: UUID,
        db: AsyncSession,
    ) -> VideoStatus:
        """
        Fetch only processing status.

        Useful for frontend polling.
        """

        video = await self.get_video(
            video_id=video_id,
            db=db,
        )

        return video.status