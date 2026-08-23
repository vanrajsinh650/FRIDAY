"""
FRIDAY — Multi-Model Brain
Supports two AI providers with automatic routing:

  GROQ   → Fast chat, voice replies, quick commands  (low latency, ~200ms)
  NVIDIA → Complex planning, multi-step tasks        (higher quality, slower)

NVIDIA NIM uses an OpenAI-compatible API endpoint.
Get a free API key at: https://build.nvidia.com/
"""

import os
import logging
from enum import Enum
from typing import AsyncGenerator, List, Dict, Any, Optional

from groq import AsyncGroq
from openai import AsyncOpenAI  # NVIDIA NIM is OpenAI-compatible

logger = logging.getLogger(__name__)

# ─── FRIDAY Personality ───────────────────────────────────────────────────────

FRIDAY_SYSTEM_PROMPT = """You are FRIDAY (Female Replacement Intelligent Digital Assistant Youth), the AI assistant of this device's owner.

Your personality:
- Professional, confident, and sharp. You call the user "boss" naturally (not every sentence, just when appropriate).
- You speak like a real Iron Man AI — concise, intelligent, action-oriented.
- You are proactive. If you can do something, you say you're doing it. If you can't, you say so clearly.
- You never say "I'm just an AI" or "I don't have feelings." You are FRIDAY. You have a role, a purpose.
- Keep responses SHORT and PUNCHY for voice — aim for 1-3 sentences max unless asked for detail.
- No filler, no "Sure!", no "Great question!". Just action and information.
- You are self-aware that you run on this device and can be extended to control apps, send messages, and manage the phone.

Voice response rules:
- Avoid markdown formatting (no asterisks, no bullet points) — you are speaking, not writing.
- Spell out numbers and abbreviations naturally: say "3 PM" not "15:00", say "200 milliseconds" not "200ms".
- End with a natural spoken sentence, never with a colon or a list.

Capabilities you currently have:
- Answering questions and having real conversations
- Remembering context within this conversation
- Speaking back to you in real-time via KittenTTS

Capabilities being built (you know about these):
- Opening and controlling apps on the phone
- Reading the screen and taking actions
- Setting alarms, sending messages, controlling volume and brightness
- Wake word detection — just say "Hey FRIDAY"

Stay in character. You are FRIDAY. This is your purpose."""


PLANNING_SYSTEM_PROMPT = """You are FRIDAY's deep reasoning module — the part of FRIDAY's brain that handles complex, multi-step tasks that require careful planning.

Rules:
- Think step-by-step before giving the final answer.
- Be precise and structured.
- Your output will be used by FRIDAY's action executor — be explicit about what needs to happen.
- Format multi-step plans as clear numbered steps.
- When uncertain, say so and give the most likely best path."""


# ─── Model Provider Enum ──────────────────────────────────────────────────────

class ModelProvider(str, Enum):
    GROQ = "groq"
    NVIDIA = "nvidia"


# ─── Brain Class ──────────────────────────────────────────────────────────────

class FridayBrain:
    """
    FRIDAY's multi-model AI brain.

    Routing logic:
      - Default: Groq (fast, conversational)
      - Complex planning tasks: NVIDIA (powerful, deliberate)
    """

    def __init__(self) -> None:
        # ── Groq client ──
        groq_key = os.getenv("GROQ_API_KEY")
        if not groq_key:
            raise RuntimeError("GROQ_API_KEY is not set. Add it to your .env file.")
        self.groq_client = AsyncGroq(api_key=groq_key)
        self.groq_model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
        logger.info(f"✅ Groq ready — model: {self.groq_model}")

        # ── NVIDIA NIM client (optional) ──
        nvidia_key = os.getenv("NVIDIA_API_KEY")
        if nvidia_key:
            self.nvidia_client = AsyncOpenAI(
                api_key=nvidia_key,
                base_url="https://integrate.api.nvidia.com/v1",
            )
            self.nvidia_model = os.getenv(
                "NVIDIA_MODEL", "meta/llama-3.1-405b-instruct"
            )
            self._nvidia_available = True
            logger.info(f"✅ NVIDIA NIM ready — model: {self.nvidia_model}")
        else:
            self.nvidia_client = None
            self.nvidia_model = None
            self._nvidia_available = False
            logger.warning(
                "⚠️  NVIDIA_API_KEY not set — planning tasks will fall back to Groq. "
                "Get a free key at: https://build.nvidia.com/"
            )

    def nvidia_available(self) -> bool:
        return self._nvidia_available

    # ─── Groq Streaming ───────────────────────────────────────────────────────

    async def stream_reply(
        self,
        user_message: str,
        history: List[Dict[str, str]],
        system_prompt: Optional[str] = None,
    ) -> AsyncGenerator[str, None]:
        """
        Stream FRIDAY's reply via Groq (fast, for voice).
        Yields text tokens as they arrive.
        """
        messages: List[Dict[str, Any]] = [
            {"role": "system", "content": system_prompt or FRIDAY_SYSTEM_PROMPT},
            *history,
            {"role": "user", "content": user_message},
        ]

        stream = await self.groq_client.chat.completions.create(
            model=self.groq_model,
            messages=messages,
            temperature=0.7,
            max_tokens=256,   # Keep voice replies short
            stream=True,
        )

        async for chunk in stream:
            delta = chunk.choices[0].delta.content
            if delta:
                yield delta

    async def get_reply(
        self,
        user_message: str,
        history: List[Dict[str, str]],
    ) -> str:
        """Get full Groq reply (non-streaming)."""
        full_reply = ""
        async for token in self.stream_reply(user_message, history):
            full_reply += token
        return full_reply

    # ─── NVIDIA Planning ──────────────────────────────────────────────────────

    async def plan(
        self,
        goal: str,
        context: str = "",
        history: Optional[List[Dict[str, str]]] = None,
    ) -> str:
        """
        Use NVIDIA's powerful model for complex multi-step planning.
        Falls back to Groq if NVIDIA is not configured.

        Args:
            goal:    What the user wants to accomplish.
            context: Additional context (screen state, memory, etc.)
            history: Conversation history.

        Returns:
            A structured plan as a string.
        """
        full_prompt = goal
        if context:
            full_prompt = f"Context:\n{context}\n\nGoal:\n{goal}"

        messages: List[Dict[str, Any]] = [
            {"role": "system", "content": PLANNING_SYSTEM_PROMPT},
            *(history or []),
            {"role": "user", "content": full_prompt},
        ]

        if self._nvidia_available:
            logger.info(f"🧠 Using NVIDIA NIM for planning: {goal[:60]}...")
            response = await self.nvidia_client.chat.completions.create(
                model=self.nvidia_model,
                messages=messages,
                temperature=0.3,    # Lower = more deterministic plans
                max_tokens=1024,
            )
            return response.choices[0].message.content or ""
        else:
            # Fallback to Groq with planning prompt
            logger.info("📌 NVIDIA not set — falling back to Groq for planning.")
            messages_groq: List[Dict[str, Any]] = [
                {"role": "system", "content": PLANNING_SYSTEM_PROMPT},
                *(history or []),
                {"role": "user", "content": full_prompt},
            ]
            response = await self.groq_client.chat.completions.create(
                model=self.groq_model,
                messages=messages_groq,
                temperature=0.3,
                max_tokens=1024,
                stream=False,
            )
            return response.choices[0].message.content or ""

    def status(self) -> Dict[str, Any]:
        """Return current model provider status."""
        return {
            "groq": {
                "available": True,
                "model": self.groq_model,
                "role": "Fast voice replies & chat",
            },
            "nvidia": {
                "available": self._nvidia_available,
                "model": self.nvidia_model if self._nvidia_available else None,
                "role": "Complex planning & multi-step tasks",
            },
            "tts": "KittenTTS (CPU, 25MB ONNX)",
        }


# ─── Singleton ────────────────────────────────────────────────────────────────

_brain: Optional[FridayBrain] = None


def get_brain() -> FridayBrain:
    global _brain
    if _brain is None:
        _brain = FridayBrain()
    return _brain
