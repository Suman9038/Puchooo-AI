from sqlalchemy.orm import relationship
from sqlalchemy import (Column, String, DateTime, UUID, ForeignKey,Boolean,Index,Text)
from app.core.database import Base
import uuid 
from enum import Enum
from sqlalchemy import Enum as SqlEnum
from sqlalchemy.sql import func

class UserRole(str,Enum):
    USER = "user"
    ADMIN = "admin"

class VideoStatus(str, Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    READY = "READY"
    FAILED = "FAILED"

class MessageRole(str, Enum):
    USER = "USER"
    ASSISTANT = "ASSISTANT"

class User(Base):
    __tablename__ = "users"
    id = Column(UUID(as_uuid=True), primary_key=True, index=True, default=uuid.uuid4)
    username = Column(String, unique=True, nullable=False, index=True)
    email = Column(String, unique=True, nullable=False, index=True)
    password = Column(String, nullable=False)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    role = Column(SqlEnum(UserRole,values_callable=lambda obj:[e.value for e in obj], name="user_role"), default=UserRole.USER, nullable=False, server_default=UserRole.USER.value)
    is_verified = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=func.now())
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())

    conversations = relationship(
    "Conversation",
    back_populates="user",
    cascade="all, delete-orphan",
    lazy="selectin"
    )

    def __repr__(self):
        return f"<User(id='{self.id}', username='{self.username}')>"


class Video(Base):

    __tablename__ = "videos"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    youtube_video_id = Column(String(50),nullable=False, unique=True, index=True)
    youtube_url = Column(String(500),nullable=False)
    title = Column(String(255), nullable=True)
    thumbnail_url = Column(String(500), nullable=True)
    language = Column(String(20),nullable=True)
    status = Column(SqlEnum(VideoStatus,values_callable=lambda obj: [e.value for e in obj],name="video_status"),nullable=False,default=VideoStatus.PENDING,server_default=VideoStatus.PENDING.value)
    indexed_at = Column(DateTime(timezone=True),nullable=True)
    error_message = Column(Text,nullable=True)
    created_at = Column(DateTime(timezone=True),default=func.now())
    updated_at = Column(DateTime(timezone=True),default=func.now(),onupdate=func.now())

    conversations = relationship(
        "Conversation",
        back_populates="video",
        cascade="all, delete-orphan",
        lazy="selectin"
    )



class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    video_id = Column(
        UUID(as_uuid=True),
        ForeignKey("videos.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    title = Column(String(255), nullable=True)

    created_at = Column(DateTime(timezone=True), default=func.now())
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())

    user= relationship("User", back_populates="conversations")
    
    video = relationship("Video", back_populates="conversations")

    messages= relationship("Message", back_populates="conversation", cascade="all, delete-orphan",lazy="selectin",passive_deletes=False)

    # Composite index for the most common query pattern
    __table_args__ = (
        Index("ix_conversation_user_video_created", "user_id", "video_id", "created_at"),
    )


class Message(Base):
    __tablename__ = "messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    conversation_id = Column(
        UUID(as_uuid=True),
        ForeignKey(
            "conversations.id",
            ondelete="CASCADE"
        ),
        index=True,
        nullable=False
    )

    role = Column(
        SqlEnum(
            MessageRole,
            values_callable=lambda obj:[e.value for e in obj],
            name="message_role"
        ),
        nullable=False
    )

    content = Column(Text, nullable=False)

    created_at = Column(DateTime(timezone=True), default=func.now()) 
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())

    conversation = relationship("Conversation", back_populates="messages")

    # Composite index: conversation ke messages ko time order mein fetch karne ke liye
    __table_args__ = (
        Index("ix_message_convo_created", "conversation_id", "created_at"),
    )
