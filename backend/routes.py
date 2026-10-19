from flask import Blueprint, jsonify, request, g, make_response
from backend.models import Conversation, User, Message, RefreshToken
from backend.extensions import db
from sqlalchemy import select, update
import os
from dotenv import load_dotenv
from google import genai
import jwt
from functools import wraps
from datetime import datetime, timedelta, timezone
import secrets
import hashlib
from uuid import uuid4

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")
secret_key = os.getenv("JWT_SECRET_KEY")

api_bp = Blueprint("conversation", __name__, url_prefix="/api")

def get_client_gemini():
    return genai.Client(api_key=api_key)


#======ACCOUNT AND AUTH======
# Login
@api_bp.route('/login', methods=["POST"])
def login():
    # Check fields
    data = request.get_json() or {}
    email = data.get("email")
    password = data.get("password")
    if not data or not email or not password:
        return jsonify({"error" : "missing required field"}), 400

    stmt = select(User).where(User.email == email)
    user = db.session.scalar(stmt)
    if not user:
        return jsonify({"error" : "Invalid credentials"}), 401
    if not user.check_password(password):
        return jsonify({"error" : "Invalid credentials"}), 401

    #  Create access token
    payload = {
        "sub" : user.id,
        "exp" : datetime.now(timezone.utc) + timedelta(minutes=30)
    }

    # Create refresh token
    refresh_token = secrets.token_urlsafe(32)
    new_refresh_token = RefreshToken(
        user_id = user.id,
        token_hash = hashlib.sha256(refresh_token.encode()).hexdigest(),
        expires_at = datetime.now(timezone.utc) + timedelta(days=7),
        revoked_at = None,
        family_id = str(uuid4())
    )

    # Save refresh token to DB
    try:
        db.session.add(new_refresh_token)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({"error" : str(e)}), 500

    access_token = jwt.encode(payload, secret_key, algorithm='HS256')
    resp = make_response(jsonify({"access_token" : access_token}), 200)
    resp.set_cookie(
        "refresh_token",
        refresh_token,
        max_age=7*24*60*60,
        httponly=True,
        samesite="Lax",
    )
    return resp
    

# Register
@api_bp.route('/register', methods=["POST"])
def register():
    data = request.get_json() or {}
    email = data.get("email")
    password = data.get("password")

    if not data or not email or not password:
        return jsonify({"error" : "Email and password are required"}), 400
    stmt = select(User).where(User.email == email)
    user = db.session.scalar(stmt)
    if not user:
        new_user = User(
            email = email
        )
        new_user.set_password(password)
        try:
            db.session.add(new_user)
            db.session.commit()
            return jsonify({"message" : "registration successful"}), 200
        except Exception as e:
            db.session.rollback()
            return jsonify({"error": str(e)}), 500
    db.session.rollback()
    return jsonify({"error" : "Email already exists"}), 409
    

# Decorator to require JWT authentication
def jwt_required(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        parts = request.headers.get("Authorization", "").split()
        if len(parts) != 2 or parts[0].lower() != "bearer":
            return jsonify({"error": "Invalid Authorization header"}), 401
        token = parts[1]
        try:
            payload = jwt.decode(token, secret_key, algorithms=["HS256"], options={"require": ["exp", "sub"]})
        except jwt.ExpiredSignatureError:
            return jsonify({"error" : "Token has expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error" : "Invalid token"}), 401
        g.user_id = str(payload["sub"])
        return f(*args, **kwargs)
    return wrapper


# Logout
@api_bp.route('/logout', methods=["POST"])
@jwt_required
def logout():
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        return jsonify({"error" : "Logged out"}), 200
    try:
        token_hash = hashlib.sha256(refresh_token.encode()).hexdigest()
        stmt = select(RefreshToken).where(RefreshToken.token_hash == token_hash)
        refresh_token_obj = db.session.scalar(stmt)

        if not refresh_token_obj:
            return jsonify({"error" : "Refresh token is invalid"}), 401
        refresh_token_obj.revoked_at = datetime.now(timezone.utc)
        resp = make_response(jsonify({"message" : "Logged out"}), 200)
        resp.delete_cookie("refresh_token", httponly=True, samesite="Lax")
        return resp
    except Exception as e:
        db.session.rollback()
        return jsonify({"error" : str(e)}), 500


# Refresh access token
@api_bp.route('/refresh', methods=["POST"])
def refresh():
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        return jsonify({"error" : "Refresh token is missing"}), 401
    token_hash = hashlib.sha256(refresh_token.encode()).hexdigest()
    stmt = select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    refresh_token_obj = db.session.scalar(stmt)

    if not refresh_token_obj:
        return jsonify({"error" : "Refresh token is invalid"}), 401
    
    if refresh_token_obj.revoked_at is not None:
        # Revoke all tokens in the same family
        try:
            now = datetime.now(timezone.utc)
            db.session.execute(
                update(RefreshToken)
                .where(RefreshToken.family_id == refresh_token_obj.family_id)
                .values(revoked_at=now)
            )
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            return jsonify({"error" : str(e)}), 500
        resp = make_response(jsonify({"error" : "Refresh token has been revoked"}), 401)
        resp.delete_cookie("refresh_token", httponly=True, samesite="Lax")
        return resp
    
    if refresh_token_obj.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        resp = make_response(jsonify({"error" : "Refresh token has expired"}), 401)
        resp.delete_cookie("refresh_token", httponly=True, samesite="Lax")
        return resp
    
    refresh_token_obj.revoked_at = datetime.now(timezone.utc)
    # Create new access token 
    payload = {
        "sub" : refresh_token_obj.user_id,
        "exp" : datetime.now(timezone.utc) + timedelta(minutes=30)
    }
    access_token = jwt.encode(payload, secret_key, algorithm='HS256')
    
    # Create new refresh token
    refresh_token = secrets.token_urlsafe(32)
    new_refresh_token = RefreshToken(
        user_id = refresh_token_obj.user_id,
        token_hash = hashlib.sha256(refresh_token.encode()).hexdigest(),
        expires_at = datetime.now(timezone.utc) + timedelta(days=7),
        revoked_at = None,
        family_id = refresh_token_obj.family_id
    )
    # Save refresh token to DB
    try:
        db.session.add(new_refresh_token)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({"error" : str(e)}), 500

    # Create response
    resp = make_response(jsonify({"access_token" : access_token}), 200)
    resp.set_cookie(
        "refresh_token",
        refresh_token,
        max_age=7*24*60*60,
        httponly=True,
        samesite="Lax",
    )
    return resp


#=====CONVERSATION=====
# Get all conversations
@api_bp.route("/conversations", methods=["GET"])
@jwt_required
def get_all_conversations():
    try:
        stmt = select(Conversation).where(Conversation.user_id == g.user_id).order_by(Conversation.updated_at.desc())
        conversations = db.session.scalars(stmt).all()
        return jsonify([conversation.to_dict() for conversation in conversations]), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error" : str(e)}), 500


# Add 1 conversation
@api_bp.route("/conversations", methods=["POST"])
@jwt_required
def add_conversation():
    data = request.get_json() or {}
    conv = Conversation(
        title = data.get("title", "Cuộc trò truyện mới"),
        user_id = g.user_id
    )
    try:
        db.session.add(conv)
        db.session.commit()
        return jsonify(conv.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"errors" : str(e)}), 500


# Delete one conversation
@api_bp.route("/conversations/<string:conversation_id>", methods=["DELETE"])
@jwt_required
def delete_conversation(conversation_id):
    try:
        conv = db.session.get(Conversation, conversation_id)
        if not conv:
            return jsonify({"error" : "Conversation not found"}), 404
        if conv.user_id != g.user_id:
            return jsonify({"error" : "Forbidden"}), 403
        db.session.delete(conv)
        db.session.commit()
        return jsonify({"message" : "delete successfuly"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error" : str(e)}), 500


# Rename conversation
@api_bp.route("/conversations/<string:conversation_id>", methods=["PATCH"])
@jwt_required
def update_title(conversation_id):
    data = request.get_json() or {}
    title = data.get("new_title")
    if not title:
        return jsonify({"error" : "missing required field: title"}), 400
    try:
        conv = db.session.get(Conversation, conversation_id)
        if not conv:
            return jsonify({"error": "Conversation not found"}), 404
        if conv.user_id != g.user_id:
            return jsonify({"error" : "Forbidden"}), 403
        conv.title = title
        db.session.commit()
        return jsonify(conv.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


#=====CHAT=====
# Get all messages in a conversation
@api_bp.route("/conversations/<string:conversation_id>/messages", methods=["GET"])
@jwt_required
def get_all_messages(conversation_id):
    conversation = db.session.get(Conversation, conversation_id)
    if not conversation:
        return jsonify({"error": "Conversation not found"}), 404
    if conversation.user_id != g.user_id:
        return jsonify({"error": "Forbidden"}), 403
    try:
        stmt = select(Message).where(Message.conversation_id == conversation_id).order_by(Message.created_at.asc())
        messages = db.session.scalars(stmt).all()
        return jsonify([message.to_dict() for message in messages]), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error" : str(e)}), 500


# Process message
@api_bp.route("/chat/<string:conversation_id>", methods=["POST"])
@jwt_required
def chat(conversation_id):
    conversation = db.session.get(Conversation, conversation_id)
    if not conversation:
        return jsonify({"error" : "Conversation not found"}), 404
    if conversation.user_id != g.user_id:
        return jsonify({"error": "Forbidden"}), 403
    
    data = request.get_json() or {}
    message = data.get("message")
    role = "user"
    if not message:
        return jsonify({"error" : "missing required field: message"}), 400

    # Save message user to DB
    try:
        new_message_user = Message(
            role = role,
            content = message,
            conversation_id = conversation_id
        )
        db.session.add(new_message_user)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({"error" : str(e)}), 500

    # Call api gemini to process message
    try:
        client = get_client_gemini()
        response = client.models.generate_content(
            model="gemini-3.5-flash",
            contents=message
        )
        reply_text = response.text
    except Exception as e:
        return jsonify({"error" : str(e),
                        "message" : "Something went wrong, please try again later"}), 502

    # Save reply to DB
    try:
        new_message_assistant = Message(
            role = "assistant",
            content = reply_text,
            conversation_id = conversation_id
        )
        db.session.add(new_message_assistant)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({"error" : str(e)}), 500

    return jsonify({"content" : reply_text, "role":"assistant"}), 200
