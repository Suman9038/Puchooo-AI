from uuid import UUID
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.logger import logger
from app.models.models import Video, VideoStatus
from datetime import datetime,timezone


class VideoRepository:
    """
    Repository responsible only for Video table operations.
    """
    async def create_video(
        self,
        youtube_video_id: str,
        youtube_url: str,
        db: AsyncSession,
        title: str = None,
        thumbnail_url: str = None
    ) -> Video:
        """
        Create new video entry.
        """
        logger.info(f"Creating video entry for YouTube video_id={youtube_video_id}")
        try :
            video = Video(
                youtube_video_id=youtube_video_id,
                youtube_url=youtube_url,
                title=title,
                thumbnail_url=thumbnail_url,
                status= VideoStatus.PENDING
            )
            db.add(video)
            await db.commit()
            await db.refresh(video)
            logger.info(
                f"Video created | "
                f"video_id={video.id} | "
                f"youtube_video_id={youtube_video_id}"
            )
            return video
        except IntegrityError:
            await db.rollback()
            logger.warning(
                f"IntegrityError: Video already exists | "
                f"youtube_video_id={youtube_video_id}"
            )
            existing_video = await self.get_by_youtube_video_id(
                youtube_video_id,
                db,
            )

            return existing_video

    async def get_by_video_id(
        self,
        video_id: UUID,
        db: AsyncSession,
    ) -> Video | None:
        """
        Get video by primary key.
        """

        result = await db.execute(
            select(Video).where(
                Video.id == video_id
            )
        )

        return result.scalar_one_or_none()

    async def get_by_youtube_video_id(
        self,
        youtube_video_id: str,
        db: AsyncSession,
    ) -> Video | None:
        """
        Fetch video using YouTube video id.
        Used to prevent duplicate indexing.
        """
        logger.info(
            f"Searching video | "
            f"youtube_video_id={youtube_video_id}"
        )

        result = await db.execute(
            select(Video).where(
                Video.youtube_video_id == youtube_video_id
            )
        )

        video = result.scalar_one_or_none()

        if video:

            logger.info(
                "Existing video found."
            )

        else:

            logger.info(
                "Video not found."
            )

        return video

    async def update_status(
        self,
        video: Video,
        status: VideoStatus,
        db: AsyncSession,
        error_message: str | None = None,
    ) -> Video:
        """
        Update indexing status.

        READY  -> indexed_at updated

        FAILED -> error_message stored
        """

        video.status = status

        if status == VideoStatus.READY:
            video.indexed_at = datetime.now(timezone.utc)
            video.error_message = None

        elif status == VideoStatus.FAILED:
            video.error_message = error_message
            
        else:
            video.error_message = None

        await db.commit()

        await db.refresh(video)

        logger.info(
            f"Video status updated | "
            f"video={video.youtube_video_id} | "
            f"status={status}"
        )

        return video

    async def update_metadata(
        self,
        video: Video,
        db: AsyncSession,
        *,
        language: str | None = None,
    ):
        if language is not None:
            video.language = language

        await db.commit()
        await db.refresh(video)

        return video

    async def delete_video(
        self,
        video: Video,
        db: AsyncSession,
    ) -> bool:
        """
        Delete a video.
        """

        await db.delete(video)
        await db.commit()

        logger.info(
            f"Video deleted | "
            f"youtube_video_id={video.youtube_video_id}"
        )

        return True

    async def get_all_videos(self, db: AsyncSession) -> list[Video]:
        """
        Get all videos from the database.
        """
        result = await db.execute(select(Video).order_by(Video.created_at.desc()))
        return list(result.scalars().all())

    