"""
FRIDAY — TTS Engine
Dual-mode voice synthesis:

  PRIMARY (works right now):
    Groq PlayAI TTS — cloud-based, uses your existing GROQ_API_KEY.
    Voice: "Fritz-PlayAI" (clear, professional male)

  FUTURE (when Python 3.12 is installed):
    KittenTTS — 25MB ONNX model, 100% CPU, offline, on-device.
    Swap by setting TTS_ENGINE=kittentts in .env

The code for both engines is here. KittenTTS just lazy-loads when available.
"""

import io
import os
import wave
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# ─── Config ──────────────────────────────────────────────────────────────────

# Set TTS_ENGINE=kittentts in .env to use KittenTTS once Python 3.12 is set up
TTS_ENGINE = os.getenv("TTS_ENGINE", "groq").lower()

# Groq TTS voice — options: Fritz-PlayAI, Celeste-PlayAI, Chip-PlayAI, etc.
# Fritz = clear professional male; Celeste = natural female
GROQ_TTS_VOICE = os.getenv("FRIDAY_VOICE", "Celeste-PlayAI")
GROQ_TTS_MODEL = "playai-tts"

# KittenTTS (future) config
KITTEN_VOICE = "Bella"
KITTEN_SPEED = 1.05
SAMPLE_RATE = 24000

# ─── Lazy-loaded engines ─────────────────────────────────────────────────────
_kitten_model = None
_kitten_available = False
_groq_tts_client = None


def _get_groq_client():
    """Get or create the Groq sync client for TTS."""
    global _groq_tts_client
    if _groq_tts_client is not None:
        return _groq_tts_client

    try:
        from groq import Groq  # sync client for audio
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            raise RuntimeError("GROQ_API_KEY not set.")
        _groq_tts_client = Groq(api_key=api_key)
        logger.info("✅ Groq TTS (PlayAI) ready.")
        return _groq_tts_client
    except Exception as e:
        logger.error(f"❌ Groq TTS init failed: {e}")
        raise


def _try_load_kittentts():
    """Attempt to load KittenTTS. Fails silently if not installed."""
    global _kitten_model, _kitten_available
    if _kitten_available:
        return True
    try:
        from kittentts import KittenTTS  # type: ignore
        _kitten_model = KittenTTS("KittenML/kitten-tts-mini-0.8")
        _kitten_available = True
        logger.info("✅ KittenTTS loaded — local CPU voice engine ready.")
        return True
    except ImportError:
        logger.info("ℹ️  KittenTTS not installed — using Groq TTS.")
        return False
    except Exception as e:
        logger.warning(f"⚠️  KittenTTS load failed: {e}")
        return False


# ─── Public API ──────────────────────────────────────────────────────────────

def is_available() -> bool:
    """TTS is always available as long as GROQ_API_KEY is set."""
    return bool(os.getenv("GROQ_API_KEY"))


def current_engine() -> str:
    """Return which TTS engine is active."""
    if TTS_ENGINE == "kittentts" and _try_load_kittentts():
        return "kittentts"
    return "groq-playai"


def synthesize(text: str, voice: Optional[str] = None, speed: Optional[float] = None) -> bytes:
    """
    Convert text to speech and return WAV bytes.

    Automatically routes to KittenTTS (if installed + configured)
    or Groq PlayAI TTS (default, cloud-based, uses GROQ_API_KEY).

    Returns:
        Raw WAV bytes (can be played directly or streamed).
    """
    if not text.strip():
        raise ValueError("Text cannot be empty.")

    # Try KittenTTS if configured
    if TTS_ENGINE == "kittentts" and _try_load_kittentts():
        return _synthesize_kitten(text, voice=voice, speed=speed)

    # Default: Groq PlayAI
    return _synthesize_groq(text, voice=voice)


def _synthesize_groq(text: str, voice: Optional[str] = None) -> bytes:
    """Synthesize using Groq PlayAI TTS. Returns WAV bytes."""
    client = _get_groq_client()
    selected_voice = voice or GROQ_TTS_VOICE

    # Groq TTS returns raw audio bytes
    response = client.audio.speech.create(
        model=GROQ_TTS_MODEL,
        voice=selected_voice,
        input=text,
        response_format="wav",
    )

    # response.content is raw WAV bytes
    return response.content


def _synthesize_kitten(text: str, voice: Optional[str] = None, speed: Optional[float] = None) -> bytes:
    """Synthesize using KittenTTS (local CPU ONNX). Returns WAV bytes."""
    import numpy as np

    audio_array = _kitten_model.generate(
        text,
        voice=voice or KITTEN_VOICE,
        speed=speed or KITTEN_SPEED,
        clean_text=True,
    )
    return _numpy_to_wav(audio_array)


def _numpy_to_wav(audio_array) -> bytes:
    """Convert numpy float32 audio array → 16-bit PCM WAV bytes."""
    import numpy as np
    audio_int16 = (np.clip(audio_array, -1.0, 1.0) * 32767).astype(np.int16)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        wf.writeframes(audio_int16.tobytes())
    buf.seek(0)
    return buf.read()


def available_voices() -> list:
    """Return available voices for the current engine."""
    if TTS_ENGINE == "kittentts" and _try_load_kittentts() and _kitten_model:
        return list(_kitten_model.available_voices)
    # Groq PlayAI voices
    return [
        "Celeste-PlayAI",   # Natural female — FRIDAY default
        "Fritz-PlayAI",     # Clear male
        "Chip-PlayAI",      # Friendly male
        "Whimsy-PlayAI",    # Expressive female
        "Angie-PlayAI",     # Professional female
        "Atlas-PlayAI",     # Deep male
    ]


# Alias for config reference
FRIDAY_VOICE = GROQ_TTS_VOICE
