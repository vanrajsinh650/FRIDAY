"""
FRIDAY — Session memory manager.
Stores per-session conversation history in memory.
(Will be replaced by persistent DB in Phase 2.)
"""

import uuid
from typing import Dict, List


# conversation history format:
# [{"role": "user" | "assistant", "content": "..."}]
_sessions: Dict[str, List[Dict[str, str]]] = {}


def create_session() -> str:
    """Create a new session and return its ID."""
    session_id = str(uuid.uuid4())
    _sessions[session_id] = []
    return session_id


def get_history(session_id: str) -> List[Dict[str, str]]:
    """Get conversation history for a session. Returns empty list if not found."""
    return _sessions.get(session_id, [])


def append_turn(session_id: str, role: str, content: str) -> None:
    """Append a user or assistant message to the session history."""
    if session_id not in _sessions:
        _sessions[session_id] = []
    _sessions[session_id].append({"role": role, "content": content})
    # Keep last 20 turns to avoid token overflow
    if len(_sessions[session_id]) > 20:
        _sessions[session_id] = _sessions[session_id][-20:]


def clear_session(session_id: str) -> None:
    """Clear conversation history for a session."""
    if session_id in _sessions:
        _sessions[session_id] = []


def list_sessions() -> List[str]:
    """Return all active session IDs."""
    return list(_sessions.keys())
