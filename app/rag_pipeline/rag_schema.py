from pydantic import BaseModel
from pydantic import HttpUrl
from typing import List

    
class IndexingResponse(BaseModel):
    success: bool
    message: str
    video_id: str
    language: str
    segments: int
    chunks_indexed: int

class AskQuestionResponse(BaseModel):
    answer: str

class CreateConversationRequest(BaseModel):
    youtube_url: HttpUrl

class AskQuestionRequest(BaseModel):
    question: str

from datetime import datetime
from uuid import UUID
from typing import Optional
from pydantic import ConfigDict
from app.models.models import MessageRole

class MessageResponse(BaseModel):
    id: UUID
    role: MessageRole
    content: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class VideoMiniResponse(BaseModel):
    id: UUID
    youtube_video_id: str
    title: Optional[str] = None
    thumbnail_url: Optional[str] = None
    status: str
    model_config = ConfigDict(from_attributes=True)

class ConversationResponse(BaseModel):
    id: UUID
    title: Optional[str] = None
    created_at: datetime
    messages: Optional[List[MessageResponse]] = None
    video: VideoMiniResponse
    model_config = ConfigDict(from_attributes=True)

class CreateConversationResponse(BaseModel):
    message: str
    conversation_id: UUID
    video_id: UUID