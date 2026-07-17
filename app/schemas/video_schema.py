from pydantic import HttpUrl, Field, ConfigDict
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, field_validator
from typing import Annotated  
from enum import Enum  

class VideoStatus(str, Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    READY = "READY"
    FAILED = "FAILED"

class VideoProcessRequest(BaseModel):   
    video_url: Annotated[HttpUrl, Field(..., title="Youtube Video Url", description="Give the Youtube Video Url", examples=["https://www.youtube.com/watch?v=lRArylZCeOs"])]



    @field_validator("video_url")
    @classmethod
    def validate_url(cls, v: HttpUrl) -> HttpUrl:
        from app.utils.youtube import YoutubeUtils  # Local import to avoid circular dependency
        
        url = str(v).strip()
        if not YoutubeUtils.is_valid_youtube_url(url):
            raise ValueError("Invalid YouTube URL provided.")
        return v


class VideoProcessResponse(BaseModel):
    video_id: UUID 
    yt_video_id: str
    status: VideoStatus
    message: str
    title: str | None = None
    thumbnail_url: str | None = None

    model_config = ConfigDict(from_attributes=True) # This is used to convert the database model to a Pydantic model and help pydantic to understand the object


class VideoStatusResponse(BaseModel):
    video_id: UUID
    status: VideoStatus

class VideoResponse(BaseModel):
    id: UUID
    youtube_video_id: str
    youtube_url: str
    title: str | None = None
    thumbnail_url: str | None = None
    status: VideoStatus
    error_message: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class VideoDeleteResponse(BaseModel):
    message: str