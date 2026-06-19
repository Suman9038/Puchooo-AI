from pydantic import HttpUrl, Field, ConfigDict
from uuid import UUID
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
    def validate_url(cls, v:HttpUrl)-> HttpUrl:
        url = str(v).strip()
        if ("youtube.com" not in url and "youtube.be" not in url):
            raise ValueError("Invalid Youtube Url")
        return v


class VideoProcessResponse(BaseModel):
    yt_video_id: str
    status: VideoStatus
    message: str


    model_config = ConfigDict(from_attributes=True) # This is used to convert the database model to a Pydantic model and help pydantic to understand the object 