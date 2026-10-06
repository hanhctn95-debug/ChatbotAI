from uuid import uuid4
from sqlalchemy.orm import mapped_column, Mapped, relationship
from sqlalchemy import DateTime, func, ForeignKey, String ,Text
from datetime import datetime
from backend.extensions import db
from werkzeug.security import generate_password_hash, check_password_hash

class User(db.Model):
    __tablename__ = 'users'
    id: Mapped[str] = mapped_column(String(36), default=lambda: str(uuid4()), primary_key=True)
    email: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    conversations = relationship("Conversation", back_populates="user")
    refresh_tokens = relationship("RefreshToken", back_populates="user")

    def set_password(self, password: str) -> None:
        self.password_hash = generate_password_hash(password)

    def check_password(self, password: str) -> bool:
        return check_password_hash(self.password_hash, password)

class Conversation(db.Model):
    __tablename__ = 'conversations'
    id: Mapped[str] = mapped_column(String(36), default=lambda: str(uuid4()),primary_key=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
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
    id: Mapped[str] = mapped_column(String(36), default=lambda: str(uuid4()), primary_key=True)
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    conversation_id: Mapped[str] = mapped_column(String(36), ForeignKey("conversations.id"), nullable=False)
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

class RefreshToken(db.Model):
    __tablename__ = 'refresh_tokens'
    id: Mapped[str] = mapped_column(String(36), default=lambda: str(uuid4()), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    family_id: Mapped[str] = mapped_column(String(36), nullable=False) 

    user = relationship("User", back_populates="refresh_tokens")