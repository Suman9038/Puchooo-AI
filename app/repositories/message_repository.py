from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from app.repositories.conversation_repository import ConversationRepository
from sqlalchemy import select
from app.models.models import Message, MessageRole
from app.core.logger import logger


class MessageRepository:
    def __init__(self, conversation_repo=None):
        self.conversation_repo= conversation_repo or ConversationRepository()


    async def _save_message(self,conversation_id:UUID, role: MessageRole, content:str, db:AsyncSession ):
        """
        Save a single message. 
        """
        message = Message(
            conversation_id=conversation_id,
            role=role,
            content=content,
        )

        db.add(message)
        await db.flush()

        return message

    async def save_messages(self,conversation_id:UUID, question:str, answer:str, db:AsyncSession)-> tuple[Message, Message]:
        """
        Save both messages at once and commit once.
        """
        try:
            user_message = await self._save_message(
                conversation_id=conversation_id,
                role=MessageRole.USER,
                content=question,
                db=db
            )

            assistant_message = await self._save_message(
                conversation_id=conversation_id,
                role=MessageRole.ASSISTANT,
                content=answer,
                db=db
            )

            # Save both messages at once
            await db.commit()
            await db.refresh(user_message)
            await db.refresh(assistant_message)

            return (
                user_message,
                assistant_message,
            )
        except Exception as e:
            await db.rollback()
            logger.exception(f"Failed to save messages: {e}")
            raise


    async def get_messages(self, conversation_id: UUID, user_id: UUID, db:AsyncSession):
        conversation = await self.conversation_repo.get_conversation(
            conversation_id,
            user_id,
            db
        )

        if not conversation:
            return []

        result = await db.execute(
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .order_by(Message.created_at.asc())
        )

        return result.scalars().all()

    
    async def get_recent_messages(
        self,
        conversation_id: UUID,
        db: AsyncSession,
        limit: int = 10,
    ) -> list[Message]:
        """
        Return latest messages.
        Used for LLM context window.
        """

        result = await db.execute(
            select(Message)
            .where(
                Message.conversation_id == conversation_id
            )
            .order_by(
                Message.created_at.desc()
            )
            .limit(limit)
        )

        return result.scalars().all()

