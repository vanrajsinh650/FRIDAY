"""
FRIDAY — Chat routes.

Endpoints:
  POST /api/chat          — Single turn, full response (REST)
  POST /api/chat/session  — Create a new session
  POST /api/chat/clear    — Clear session history
  GET  /api/chat/history  — Get conversation history
  WS   /ws/chat           — Streaming WebSocket chat
"""

import json
from typing import Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException
from pydantic import BaseModel

from server.core.friday_brain import get_brain
from server.core import session_memory

router = APIRouter()


# ─── Request / Response Models ───────────────────────────────────────────────

class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None  # If None, uses a temporary session


class ChatResponse(BaseModel):
    reply: str
    session_id: str


class SessionResponse(BaseModel):
    session_id: str


# ─── REST Endpoints ───────────────────────────────────────────────────────────

@router.post("/session", response_model=SessionResponse)
async def create_session():
    """Create a new conversation session. Returns the session_id to use in future calls."""
    session_id = session_memory.create_session()
    return SessionResponse(session_id=session_id)


@router.post("/clear")
async def clear_session(session_id: str):
    """Clear conversation history for a session."""
    session_memory.clear_session(session_id)
    return {"status": "cleared", "session_id": session_id}


@router.get("/history")
async def get_history(session_id: str):
    """Get full conversation history for a session."""
    history = session_memory.get_history(session_id)
    if not history:
        return {"session_id": session_id, "turns": 0, "history": []}
    return {
        "session_id": session_id,
        "turns": len(history),
        "history": history,
    }


@router.post("", response_model=ChatResponse)
async def chat(req: ChatRequest):
    """
    Send a message to FRIDAY and get a full response.
    If session_id is provided, conversation history is maintained.
    """
    session_id = req.session_id or session_memory.create_session()
    history = session_memory.get_history(session_id)

    brain = get_brain()
    reply = await brain.get_reply(req.message, history)

    session_memory.append_turn(session_id, "user", req.message)
    session_memory.append_turn(session_id, "assistant", reply)

    return ChatResponse(reply=reply, session_id=session_id)


# ─── WebSocket Streaming ──────────────────────────────────────────────────────

@router.websocket("/ws")
async def websocket_chat(websocket: WebSocket):
    """
    WebSocket endpoint for real-time streaming chat.

    Client sends JSON: {"message": "...", "session_id": "..."}
    Server streams back:
      {"type": "token", "content": "..."}   — per token
      {"type": "done", "session_id": "..."}  — when complete
      {"type": "error", "message": "..."}    — on failure
    """
    await websocket.accept()
    try:
        while True:
            raw = await websocket.receive_text()

            try:
                payload = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "message": "Invalid JSON payload."
                }))
                continue

            user_message = payload.get("message", "").strip()
            session_id = payload.get("session_id") or session_memory.create_session()

            if not user_message:
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "message": "Message cannot be empty."
                }))
                continue

            history = session_memory.get_history(session_id)
            brain = get_brain()

            full_reply = ""
            try:
                async for token in brain.stream_reply(user_message, history):
                    full_reply += token
                    await websocket.send_text(json.dumps({
                        "type": "token",
                        "content": token,
                    }))
            except Exception as e:
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "message": f"Brain error: {str(e)}"
                }))
                continue

            # Save to session memory after full reply
            session_memory.append_turn(session_id, "user", user_message)
            session_memory.append_turn(session_id, "assistant", full_reply)

            await websocket.send_text(json.dumps({
                "type": "done",
                "session_id": session_id,
            }))

    except WebSocketDisconnect:
        pass
