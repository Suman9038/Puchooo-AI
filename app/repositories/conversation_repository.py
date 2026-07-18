from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.models.models import Conversation,Message
from app.core.exceptions import ConversationNotFound

class ConversationRepository:

    async def create_conversation(self,user_id: UUID, video_id: UUID, db: AsyncSession):
        new_conversation = Conversation(user_id=user_id, video_id=video_id)
        db.add(new_conversation)
        await db.commit()
        await db.refresh(new_conversation)
        return new_conversation

    async def get_user_conversation(self, user_id: UUID, db: AsyncSession, video_id: UUID | None = None, limit: int = 50, offset: int = 0):
        query = select(Conversation).options(selectinload(Conversation.video)).where(Conversation.user_id == user_id)
        if video_id:
            query = query.where(Conversation.video_id == video_id)
        
        query = query.order_by(Conversation.created_at.desc()).limit(limit).offset(offset)
        result = await db.execute(query)
        return result.scalars().all()

    async def get_user_videos(self, user_id: UUID, db: AsyncSession):
        from app.models.models import Video
        from sqlalchemy import func
        
        result = await db.execute(
            select(Video)
            .join(Conversation, Video.id == Conversation.video_id)
            .where(Conversation.user_id == user_id)
            .group_by(Video.id)
            .order_by(func.max(Conversation.created_at).desc())
        )
        return result.scalars().all()
    
    async def get_conversation(self,conversation_id:UUID, user_id:UUID, db:AsyncSession):
        result = await db.execute(
            select(Conversation)
            .options(selectinload(Conversation.video))
            .where(
                Conversation.id == conversation_id,
                Conversation.user_id == user_id
            )
        )
        conversation = result.scalar_one_or_none()
        if not conversation:
            raise ConversationNotFound()
        return conversation

    async def get_chat_history(
    self,
    conversation_id: UUID,
    user_id: UUID,
    db: AsyncSession,
    verify_ownership: bool = True
    ) -> list[Message]:

        if verify_ownership:
            conversation = await self.get_conversation(
                conversation_id=conversation_id,
                user_id=user_id,
                db=db
            )
            if not conversation:
                raise ConversationNotFound()

        result = await db.execute(
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .order_by(Message.created_at.asc())
        )

        return list(result.scalars().all())

    async def delete_conversation(
    self,
    conversation_id: UUID,
    user_id: UUID,
    db: AsyncSession
    ):
        conversation = await self.get_conversation(
            conversation_id,
            user_id,
            db
        )
        
        if not conversation:
            return False

        await db.delete(conversation)
        await db.commit()

        return True
    
    
