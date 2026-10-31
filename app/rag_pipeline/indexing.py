from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from app.rag_pipeline.chunker import TranscriptChunkerService
from app.rag_pipeline.ingestion import YoutubeTranscriptService
from app.rag_pipeline.vector_store import QdrantService
from app.repositories.video_repository import VideoRepository
from app.models.models import VideoStatus
from app.core.logger import logger
from app.rag_pipeline.rag_schema import IndexingResponse

class VideoIndexingService:
    def __init__(self, transcript_service=None, chunker_service=None, qdrant_service=None, video_repo=None):
        self.transcript_service = transcript_service or YoutubeTranscriptService()
        self.chunker = chunker_service or TranscriptChunkerService()
        self.qdrant_service = qdrant_service or QdrantService()
        self.video_repo = video_repo or VideoRepository()

    async def index_video(self, db_video_id: UUID, db: AsyncSession) -> IndexingResponse:
        video = await self.video_repo.get_by_video_id(db_video_id, db)
        if not video:
            raise ValueError(f"Video with ID {db_video_id} not found in database.")

        try:
            logger.info(f"Starting indexing for video {video.youtube_video_id}")

            # 1. Update status to PROCESSING
            await self.video_repo.update_status(video, VideoStatus.PROCESSING, db)

            # 2. Get the transcript from the Youtube API
            transcript = self.transcript_service.fetch_transcription(video_id=video.youtube_video_id)
            if not transcript or not transcript.segments:
                raise ValueError(
                    f"Could not retrieve transcript for video {video.youtube_video_id}. "
                    "YouTube blocked the request from this cloud server (IP ban), or the video has captions disabled."
                )

            # 3. Chunking
            chunks = self.chunker.chunk_transcript(transcript)

            # 4. Adding chunk to Vector Store
            self.qdrant_service.add_documents(documents=chunks)

            # 5. Update Metadata and Status to READY
            await self.video_repo.update_metadata(video, db, language=transcript.language_code)
            await self.video_repo.update_status(video, VideoStatus.READY, db)

            logger.info(
                f"Video indexed successfully | db_id={db_video_id} | youtube_id={video.youtube_video_id} | chunks={len(chunks)}"
            )

            return IndexingResponse(
                success=True,
                message="Video indexed successfully.",
                video_id=video.youtube_video_id,
                language=transcript.language_code,
                segments=len(transcript.segments),
                chunks_indexed=len(chunks),
            )
        except Exception as e:
            logger.exception(f"Failed to index video {video.youtube_video_id}: {e}")
            await self.video_repo.update_status(video, VideoStatus.FAILED, db, error_message=str(e))
            raise