from flask import Blueprint, jsonify, request, g
from backend.models import Conversation, User, Message
from backend.extensions import db
from sqlalchemy import select, delete
import os
from dotenv import load_dotenv
from google import genai
import jwt
from functools import wraps

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
    username = data.get("username")
    password = data.get("password")
    if not data or not username or not password:
        return jsonify({"error" : "missing required field"}), 400

    stmt = select(User).where(User.username == username)
    user = db.session.scalar(stmt)
    if not user:
        return jsonify({"error" : "Invalid credentials"}), 401
    if not user.check_password(password):
        return jsonify({"error" : "Invalid credentials"}), 401
    payload = {
        "user_id" : user.id,
        "username" : user.username
    }
    token = jwt.encode(payload, secret_key, algorithm='HS256')
    return jsonify({"token" : token}), 200
    

def jwt_required(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        parts = request.headers.get("Authorization", "").split()
        if len(parts) != 2 or parts[0].lower() != "bearer":
            return jsonify({"error": "Invalid Authorization header"}), 401
        token = parts[1]
        try:
            payload = jwt.decode(token, secret_key, algorithms=["HS256"])
        except Exception as e:
            return jsonify({"error" : str(e)}), 401
        g.user_id = int(payload["user_id"])
        return f(*args, **kwargs)
    return wrapper


#=====CONVERSATION=====
# Get all conversations
@api_bp.route("/conversations", methods=["GET"])
def get_all_conversations():
    try:
        stmt = select(Conversation).order_by(Conversation.updated_at.desc())
        conversations = db.session.scalars(stmt).all()
        return jsonify([conversation.to_dict() for conversation in conversations]), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error" : str(e)}), 500


# Add 1 conversation
@api_bp.route("/conversations", methods=["POST"])
def add_conversation():
    data = request.get_json() or {}
    user_id = data.get("user_id")
    if not user_id:
        return jsonify({"error" : "missing required field: user_id"}), 400
    conv = Conversation(
        title = data.get("title", "Cuộc trò truyện mới"),
        user_id = data.get("user_id")
    )
    try:
        db.session.add(conv)
        db.session.commit()
        return jsonify(conv.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"errors" : str(e)}), 500


# Delete one conversation
@api_bp.route("/conversations/<int:conversation_id>", methods=["DELETE"])
def delete_conversation(conversation_id):
    try:
        conv = db.session.get(Conversation, conversation_id)
        if not conv:
            return jsonify({"error" : "Conversation not found"}), 404
        db.session.delete(conv)
        db.session.commit()
        return jsonify({"message" : "delete successfuly"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error" : str(e)}), 500


# Rename conversation
@api_bp.route("/conversations/<int:conversation_id>", methods=["PATCH"])
def update_title(conversation_id):
    data = request.get_json() or {}
    title = data.get("title")
    if not title:
        return jsonify({"error" : "missing required field: title"}), 400
    try:
        conv = db.session.get(Conversation, conversation_id)
        if not conv:
            return jsonify({"error": "Conversation not found"}), 404
        conv.title = title
        db.session.commit()
        return jsonify(conv.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


#=====CHAT=====
# Get all messages in a conversation
@api_bp.route("/conversations/<int:conversation_id>/messages", methods=["GET"])
def get_all_messages(conversation_id):
    try:
        stmt = select(Message).where(Message.conversation_id == conversation_id).order_by(Message.created_at.desc())
        messages = db.session.scalars(stmt).all()
        return jsonify([message.to_dict() for message in messages]), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error" : str(e)}), 500


# Process message
@api_bp.route("/chat/<int:conversation_id>", methods=["POST"])
def chat(conversation_id):
    conv = db.session.get(Conversation, conversation_id)
    if not conv:
        return jsonify({"error" : "Not found conversation"}), 404
    
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

    return jsonify({"message" : reply_text,}), 200
