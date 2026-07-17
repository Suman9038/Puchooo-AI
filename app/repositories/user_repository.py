from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.models import User
from typing import Optional
from uuid import UUID

class UserRepository:
    """
    Repository for User related database operations.
    Encapsulates all SQLAlchemy logic for the User model to keep services and routes clean.
    """

    @staticmethod
    async def get_user_by_email(email: str, db: AsyncSession) -> Optional[User]:
        """
        Fetch a user by their email address.
        Returns None if user does not exist.
        """
        result = await db.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()

    @staticmethod
    async def get_user_by_id(user_id: UUID, db: AsyncSession) -> Optional[User]:
        """
        Fetch a user by their unique ID.
        Returns None if user does not exist.
        """
        result = await db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    @staticmethod
    async def create_user(user: User, db: AsyncSession) -> User:
        """
        Add a new user to the database.
        """
        try:
            db.add(user)
            await db.commit()
            await db.refresh(user)
            return user
        except Exception as e:
            await db.rollback()
            raise 

    @staticmethod
    async def update_user(user: User, db: AsyncSession) -> User:
        """
        Commit changes made to an existing user object.
        """
        try:
            await db.commit()
            await db.refresh(user)
            return user
        except Exception as e:
            await db.rollback()
            raise

    @staticmethod
    async def delete_user(user: User, db: AsyncSession) -> None:
        """
        Delete a user from the database.
        """
        await db.delete(user)
        await db.commit()

    @staticmethod
    async def verify_user(user: User, db: AsyncSession) -> User:
        try:
            user.is_verified = True
            await db.commit()
            await db.refresh(user)
            return user
        except Exception as e:
            await db.rollback()
            raise 

    @staticmethod
    async def update_password(user: User, hashed_password: str, db: AsyncSession) -> User:
        try:
            user.password = hashed_password
            await db.commit()
            await db.refresh(user)
            return user
        except Exception as e:
            await db.rollback()
            raise