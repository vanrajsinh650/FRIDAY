"""
FRIDAY — TTS (Text-to-Speech) Routes

Endpoints:
  POST /api/tts           — Convert text to WAV audio (returns audio/wav)
  POST /api/tts/speak     — FRIDAY thinks + speaks: returns {reply, audio_base64}
  GET  /api/tts/voices    — List available voices
  GET  /api/tts/status    — Check if TTS is available
"""

import base64
from typing import Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

from server.core import tts_engine
from server.core.friday_brain import get_brain
from server.core import session_memory

router = APIRouter()


# ─── Models ──────────────────────────────────────────────────────────────────

class TTSRequest(BaseModel):
    text: str
    voice: Optional[str] = None    # Default: Bella
    speed: Optional[float] = None  # Default: 1.05


class SpeakRequest(BaseModel):
    """Send a message, get back FRIDAY's reply text + audio in one shot."""
    message: str
    session_id: Optional[str] = None
    voice: Optional[str] = None
    include_audio: bool = True     # Set False to skip TTS (text-only mode)


class SpeakResponse(BaseModel):
    reply: str
    session_id: str
    audio_base64: Optional[str] = None  # WAV audio as base64 string
    tts_available: bool


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("/status")
async def tts_status():
    """Check if KittenTTS is installed and ready."""
    available = tts_engine.is_available()
    voices = tts_engine.available_voices() if available else []
    return {
        "available": available,
        "engine": "KittenTTS (KittenML/kitten-tts-mini-0.8)",
        "model_size": "25MB ONNX",
        "cpu_only": True,
        "voices": voices,
        "friday_voice": tts_engine.FRIDAY_VOICE,
    }


@router.get("/voices")
async def list_voices():
    """List all available TTS voices."""
    voices = tts_engine.available_voices()
    if not voices:
        return {"voices": [], "note": "KittenTTS not installed yet."}
    return {
        "voices": voices,
        "friday_default": tts_engine.FRIDAY_VOICE,
    }


@router.post("/", response_class=Response)
async def text_to_speech(req: TTSRequest):
    """
    Convert text to speech.
    Returns raw WAV audio (audio/wav) — play directly in browser or phone.
    """
    if not tts_engine.is_available():
        raise HTTPException(
            status_code=503,
            detail="KittenTTS is not installed. Run the install script first."
        )

    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty.")

    try:
        wav_bytes = tts_engine.synthesize(req.text, voice=req.voice, speed=req.speed)
        return Response(
            content=wav_bytes,
            media_type="audio/wav",
            headers={"Content-Disposition": 'inline; filename="friday_reply.wav"'},
        )
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/speak", response_model=SpeakResponse)
async def friday_speak(req: SpeakRequest):
    """
    Full pipeline: user message → FRIDAY thinks (Groq) → FRIDAY speaks (KittenTTS).
    Returns reply text + optional base64-encoded WAV audio.

    The phone can decode the base64 WAV and play it directly.
    """
    session_id = req.session_id or session_memory.create_session()
    history = session_memory.get_history(session_id)

    brain = get_brain()

    # Step 1: Get FRIDAY's text reply from Groq
    reply = await brain.get_reply(req.message, history)

    # Step 2: Save to session memory
    session_memory.append_turn(session_id, "user", req.message)
    session_memory.append_turn(session_id, "assistant", reply)

    # Step 3: Convert to speech if requested and available
    audio_base64 = None
    tts_ok = tts_engine.is_available()

    if req.include_audio and tts_ok:
        try:
            wav_bytes = tts_engine.synthesize(reply, voice=req.voice)
            audio_base64 = base64.b64encode(wav_bytes).decode("utf-8")
        except Exception as e:
            # TTS failure is non-fatal — still return the text reply
            audio_base64 = None

    return SpeakResponse(
        reply=reply,
        session_id=session_id,
        audio_base64=audio_base64,
        tts_available=tts_ok,
    )
