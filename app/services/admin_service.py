from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from fastapi import HTTPException, status
from uuid import UUID

from app.models.models import User, Video, Conversation, UserRole
from app.services.video_service import VideoService

class AdminService:
    @staticmethod
    async def get_all_users(db: AsyncSession):
        result = await db.execute(select(User).order_by(User.created_at.desc()))
        return result.scalars().all()

    @staticmethod
    async def update_role(user_id: UUID, role: UserRole, db: AsyncSession):
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        
        user.role = role
        await db.commit()
        await db.refresh(user)
        return {"message": f"User role updated to {role} successfully", "email": user.email, "role": user.role}

    @staticmethod
    async def delete_user(user_id: UUID, db: AsyncSession):
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        
        await db.delete(user)
        await db.commit()
        return {"message": "User and associated data deleted successfully"}

    @staticmethod
    async def get_stats(db: AsyncSession):
        total_users = (await db.execute(select(func.count(User.id)))).scalar()
        total_videos = (await db.execute(select(func.count(Video.id)))).scalar()
        total_chats = (await db.execute(select(func.count(Conversation.id)))).scalar()
        
        return {
            "total_users": total_users,
            "total_videos": total_videos,
            "total_chats": total_chats
        }

    @staticmethod
    async def get_all_videos(db: AsyncSession):
        video_service = VideoService()
        return await video_service.get_all_videos(db)

    @staticmethod
    async def delete_video(video_id: UUID, db: AsyncSession):
        video_service = VideoService()
        return await video_service.delete_video(video_id=video_id, db=db)

    @staticmethod
    async def reprocess_video(video_id: UUID, db: AsyncSession):
        video_service = VideoService()
        return await video_service.reprocess_video(video_id=video_id, db=db)
