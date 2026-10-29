from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from app.rag_pipeline.chain import RagChain
from app.rag_pipeline.vector_store import QdrantService
from app.rag_pipeline.llm import LLMModels, DynamicModelTracker
from app.core.logger import logger
from app.repositories.conversation_repository import ConversationRepository
from app.repositories.message_repository import MessageRepository
from app.repositories.video_repository import VideoRepository
from app.models.models import (VideoStatus, MessageRole)
from langchain_core.messages import AIMessage, HumanMessage
from app.rag_pipeline.indexing import VideoIndexingService
from fastapi import HTTPException, status
from app.rag_pipeline.rag_schema import AskQuestionResponse
from app.utils.youtube import YoutubeUtils
from app.worker.celery import index_video_task
import json
from app.core.exceptions import (ConversationNotFound)

from app.services.video_service import VideoService
from app.schemas.video_schema import VideoProcessRequest

class RagService:
    def __init__(self,qdrant_service:QdrantService=None,conversation_repository:ConversationRepository=None,message_repository:MessageRepository=None,video_repository:VideoRepository=None, indexing_service: VideoIndexingService | None = None, video_service: VideoService | None = None):
        self.llm= LLMModels.get_fallback_router_llm()
        # self.llm= LLMModels.get_ollama_model()
        self.qdrant_service=qdrant_service or QdrantService()
        self.conversation_repo=conversation_repository or ConversationRepository()
        self.message_repo=message_repository or MessageRepository()
        self.video_repo=video_repository or VideoRepository()
        self.indexing_service = indexing_service or VideoIndexingService()
        self.video_service = video_service or VideoService(video_repository=self.video_repo)
        logger.info("RAG Service initialized")

    async def _build_chat_history(self, conversation_id:UUID, user_id:UUID, db: AsyncSession, verify_ownership:bool=True):
        """
        Convert database message into Langchain History
        """
        logger.info(f"Building chat history | "
            f"conversation={conversation_id}")

        messages= await(
            self.conversation_repo.get_chat_history(
                conversation_id=conversation_id,
                user_id=user_id,
                db=db, 
                verify_ownership=verify_ownership,
            )
        )
        history = []
        for message in messages:
            if message.role == MessageRole.USER:
                history.append(
                    HumanMessage(content=message.content)
                )
            
            else:
                history.append(
                    AIMessage(content=message.content)
                )
        
        logger.info(
            f"Loaded {len(history)} "
            f"history messages."
        )
        
        return history
    
    async def create_conversation(self, user_id:UUID, youtube_url:str, db:AsyncSession):
        """
        Create a new conversation. 
        if the video is not indexed it triggers indexing first.
        """
        youtube_video_id = YoutubeUtils.extract_video_id(youtube_url)
        normalized_url = YoutubeUtils.normalize_url(youtube_video_id)

        logger.info(
            f"Creating conversation | "
            f"user={user_id}| "
            f"video={youtube_video_id}"
        )

        # Let VideoService handle URL validation, indexing checks, and Celery dispatch
        request = VideoProcessRequest(video_url=normalized_url)
        video_response = await self.video_service.process_video(request=request, db=db)

        # Create the conversation
        conversation = await (
            self.conversation_repo.create_conversation(
                user_id=user_id,
                video_id=video_response.video_id,
                db=db,
            )
        )

        logger.info(
            f"Conversation created | "
            f"id={conversation.id}"
        )

        return conversation

    async def get_user_conversations(
    self,
    user_id: UUID,
    db: AsyncSession,
    video_id: UUID | None = None
    ):
        """
        Return conversations belonging to a user,
        optionally filtered by video.
        """

        logger.info(
            f"Fetching conversations | "
            f"user={user_id} | video={video_id}"
        )

        conversations = (
            await self.conversation_repo
            .get_user_conversation(
                user_id=user_id,
                db=db,
                video_id=video_id
            )
        )

        return conversations

    async def get_user_videos(
    self,
    user_id: UUID,
    db: AsyncSession,
    ):
        """
        Return unique videos processed by the user.
        """
        
        logger.info(f"Fetching unique videos | user={user_id}")
        
        return await self.conversation_repo.get_user_videos(user_id=user_id, db=db)

    async def get_conversation(
    self,
    conversation_id: UUID,
    user_id: UUID,
    db: AsyncSession,
    ):
        """
        Fetch a conversation
        after ownership verification.
        """

        conversation = (
            await self.conversation_repo
            .get_conversation(
                conversation_id=conversation_id,
                user_id=user_id,
                db=db,
            )
        )

        if conversation is None:
            raise ConversationNotFound()

        return conversation

    async def delete_conversation(
    self,
    conversation_id: UUID,
    user_id: UUID,
    db: AsyncSession
    ):
        deleted = await self.conversation_repo.delete_conversation(
            conversation_id=conversation_id,
            user_id=user_id,
            db=db
        )

        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found or access denied",
            )

        return {
            "message": "Conversation deleted successfully"
        }

    async def ask_question(self, conversation_id:UUID, user_id:UUID, question:str, db:AsyncSession):
        # Fetch the convo 
        try:
            conversation = await self.get_conversation(
                conversation_id=conversation_id,
                user_id=user_id,
                db=db
            )
            await self._update_conversation_title(
                conversation=conversation,
                question=question,
                db=db
            )

            chat_history = await self._build_chat_history(conversation_id, user_id, db, verify_ownership=False)
            video = await self.video_repo.get_by_video_id(conversation.video_id, db)
            video_title = video.title if video and video.title else "Unknown YouTube Video"

            # Pass the YouTube video ID (e.g. lRArylZCeOs) to match Qdrant chunks metadata
            rag_chain = (
                self._build_rag_chain(
                    video.youtube_video_id
                )
            )

            response = await rag_chain.ainvoke(
                {
                    "input": question,
                    "chat_history": chat_history,
                    "video_title": video_title
                }
            )
            answer = response.get(
                "answer",
                "No response generated."
            )

            await self.message_repo.save_messages(
                conversation_id=conversation_id,
                question=question,
                answer=answer,
                db=db
            )

            return AskQuestionResponse(
                answer=answer
            )
        except HTTPException:
            raise
        except Exception as e:
            await db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Unable to generate response {str(e)}"
            )

    async def ask_question_streaming(self, conversation_id: UUID, user_id: UUID, question: str, db: AsyncSession):
        full_answer = ""
        model_name = LLMModels.get_model_name()
        
        conversation = await self.get_conversation(
            conversation_id=conversation_id,
            user_id=user_id,
            db=db
        )
        await self._update_conversation_title(
            conversation=conversation,
            question=question,
            db=db
        )

        video = await self.video_repo.get_by_video_id(conversation.video_id, db)
        video_title = video.title if video and video.title else "Unknown YouTube Video"

        chat_history = await self._build_chat_history(conversation_id, user_id, db, verify_ownership=False)
        rag_chain = (
            self._build_rag_chain(
                video.youtube_video_id
            )
        )

        tracker = DynamicModelTracker()
        model_name_sent = False

        try:
            # Streaming using astream with dynamic model callback tracking
            async for chunk in rag_chain.astream(
                {
                    "input": question,
                    "chat_history": chat_history,
                    "video_title": video_title
                },
                config={"callbacks": [tracker]}
            ):
                # Emit the actual responding model as soon as generation starts
                if not model_name_sent and tracker.active_model:
                    yield f"data: {json.dumps({'model': tracker.active_model})}\n\n"
                    model_name_sent = True

                if "answer" in chunk:
                    token = chunk["answer"]
                    if token:
                        full_answer += token
                        yield f"data: {json.dumps({'token': token})}\n\n"
            
            yield f"data: {json.dumps({'done': True})}\n\n"
            
        except Exception as e:
            logger.error(f"Streaming error for conversation {conversation_id}: {e}")
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
            yield f"data: {json.dumps({'done': True})}\n\n"
            return 
            
        finally:
            # 2. Persist chat history with an isolated, dedicated database session
            # FastAPI closes the route dependency 'db' when StreamingResponse begins.
            # Using sessionlocal() guarantees messages are 100% saved without connection errors.
            if full_answer:
                try:
                    from app.core.database import sessionlocal
                    async with sessionlocal() as persist_db:
                        await self.message_repo.save_messages(
                            conversation_id=conversation_id,
                            question=question,
                            answer=full_answer,
                            db=persist_db
                        )
                        logger.info(f"Streamed messages successfully persisted for conversation={conversation_id}")
                except Exception as save_err:
                    logger.error(f"Failed to persist streamed messages for conversation={conversation_id}: {save_err}")


    def _build_rag_chain(self, video_id):
        retriever = self.qdrant_service.get_video_retriever(
            str(video_id)
        )
        print(f"\n🚀 [Puchooo AI] RAG Chain initialized with LLM: {type(self.llm).__name__}\n")

        return RagChain.build_chain(
            self.llm,
            retriever
        )

    async def _update_conversation_title(
    self,
    conversation,
    question: str,
    db: AsyncSession,
    ):
        """
        Set conversation title from the first user question.
        """

        if conversation.title:
            return

        conversation.title = question[:80].strip()

        await db.commit()
        await db.refresh(conversation)

        logger.info(
            f"Conversation title updated | "
            f"{conversation.id}"
        )
            
                