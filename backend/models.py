from sqlalchemy.orm import mapped_column, Mapped, relationship
from sqlalchemy import DateTime, func, ForeignKey
from datetime import datetime
from backend.extensions import db

class User(db.Model):
    __tablename__ = 'users'
    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(nullable=False)
    password_hash: Mapped[str] = mapped_column(nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    conversations = relationship("Conversation", back_populates="user")


class Conversation(db.Model):
    __tablename__ = 'conversations'
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False
    )
    user = relationship("User", back_populates="conversations")
    messages = relationship("Message", back_populates="conversation")

    def to_dict(self):
        return {
            "id" : self.id,
            "title" : self.title,
            "user_id" : self.user_id,
            "created_at" : int(self.created_at.timestamp() * 1000),
            "updated_at" : int(self.updated_at.timestamp() * 1000)
        }


class Message(db.Model):
    __tablename__ = 'messages'
    id: Mapped[int] = mapped_column(primary_key=True)
    role: Mapped[str] = mapped_column(nullable=False)
    content: Mapped[str] = mapped_column(nullable=False)
    conversation_id: Mapped[int] = mapped_column(ForeignKey("conversations.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    conversation = relationship("Conversation", back_populates="messages")

    def to_dict(self):
        return {
            "id" : self.id,
            "role" : self.role,
            "content" : self.content,
            "conversation_id" : self.conversation_id,
            "created_at" : int(self.created_at.timestamp() * 1000)
        }
