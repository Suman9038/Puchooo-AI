from pydantic import BaseModel, EmailStr
from uuid import UUID
from datetime import datetime
from app.models.models import UserRole

class AdminUserResponse(BaseModel):
    id: UUID
    email: EmailStr
    first_name: str | None = None
    last_name: str | None = None
    role: UserRole
    is_verified: bool
    created_at: datetime

    class Config:
        from_attributes = True

class AdminUserUpdateSchema(BaseModel):
    role: UserRole

class SystemStatsResponse(BaseModel):
    total_users: int
    total_videos: int
    total_chats: int

class AdminVideoResponse(BaseModel):
    id: UUID
    youtube_video_id: str
    youtube_url: str
    title: str | None
    status: str
    created_at: datetime

    class Config:
        from_attributes = True
