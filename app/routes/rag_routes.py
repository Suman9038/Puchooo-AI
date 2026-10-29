from fastapi import APIRouter, Depends, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from app.core.database import get_db
from app.auth.dependencies import RoleChecker
from app.models.models import User, UserRole
from app.services.rag_service import RagService
from typing import List
from app.rag_pipeline.rag_schema import (
    AskQuestionResponse, 
    CreateConversationRequest, 
    AskQuestionRequest,
    MessageResponse,
    ConversationResponse,
    CreateConversationResponse
)

router = APIRouter(
    prefix="/chat",
    tags=["Chat & RAG"]
)

# Dependency injection for RagService
def get_rag_service():
    return RagService()

any_user = RoleChecker(allowed_roles=[UserRole.USER, UserRole.ADMIN])

@router.post("/conversations", status_code=status.HTTP_201_CREATED, response_model=CreateConversationResponse)
async def create_conversation(
    request: CreateConversationRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(any_user),
    rag_service: RagService = Depends(get_rag_service)
):
    """
    Initialize a new conversation.
    If the video is not indexed, it will start the indexing process via Celery.
    """
    conversation = await rag_service.create_conversation(
        user_id=current_user.id,
        youtube_url=str(request.youtube_url),
        db=db
    )
    return {
        "message": "Conversation created",
        "conversation_id": conversation.id,
        "video_id": conversation.video_id
    }

@router.get("/conversations", status_code=status.HTTP_200_OK, response_model=List[ConversationResponse])
async def get_user_conversations(
    video_id: UUID | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(any_user),
    rag_service: RagService = Depends(get_rag_service)
):
    """
    Get conversations for the current user, optionally filtered by video.
    """
    conversations = await rag_service.get_user_conversations(
        user_id=current_user.id,
        db=db,
        video_id=video_id
    )
    return conversations

from app.schemas.video_schema import VideoResponse
@router.get("/videos", status_code=status.HTTP_200_OK, response_model=List[VideoResponse])
async def get_user_videos(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(any_user),
    rag_service: RagService = Depends(get_rag_service)
):
    """
    Get all unique videos processed/chatted by the current user.
    """
    videos = await rag_service.get_user_videos(
        user_id=current_user.id,
        db=db
    )
    return videos

@router.get("/conversations/{conversation_id}/messages", status_code=status.HTTP_200_OK, response_model=List[MessageResponse])
async def get_chat_history(
    conversation_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(any_user),
    rag_service: RagService = Depends(get_rag_service)
):
    """
    Get all messages for a specific conversation.
    """
    conversation = await rag_service.get_conversation(
        conversation_id=conversation_id,
        user_id=current_user.id,
        db=db
    )
    return conversation.messages

@router.post("/conversations/{conversation_id}/ask", response_model=AskQuestionResponse)
async def ask_question(
    conversation_id: UUID,
    request: AskQuestionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(any_user),
    rag_service: RagService = Depends(get_rag_service)
):
    """
    Ask a question and wait for the full response (No Streaming).
    """
    return await rag_service.ask_question(
        conversation_id=conversation_id,
        user_id=current_user.id,
        question=request.question,
        db=db
    )

@router.post("/conversations/{conversation_id}/stream")
async def ask_question_stream(
    conversation_id: UUID,
    request: AskQuestionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(any_user),
    rag_service: RagService = Depends(get_rag_service)
):
    """
    Ask a question and receive a Server-Sent Events (SSE) stream for typing effect.
    """
    return StreamingResponse(
        rag_service.ask_question_streaming(
            conversation_id=conversation_id,
            user_id=current_user.id,
            question=request.question,
            db=db
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

@router.delete("/conversations/{conversation_id}", status_code=status.HTTP_200_OK)
async def delete_conversation(
    conversation_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(any_user),
    rag_service: RagService = Depends(get_rag_service)
):
    """
    Delete a conversation.
    """
    return await rag_service.delete_conversation(
        conversation_id=conversation_id,
        user_id=current_user.id,
        db=db
    )
