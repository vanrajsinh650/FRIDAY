# FRIDAY — Technology Stack & Dependencies

---

## 1. Primary Technology Selections

| Subsystem | Technology | Justification |
| :--- | :--- | :--- |
| **Primary App Framework** | **React Native (0.76+)** | Rapid UI development, cross-platform architecture, TypeScript first |
| **Language** | **TypeScript 5.x** | Strong type safety for agent schemas, tool calls, and state |
| **State Management** | **Zustand** | Minimal boilerplate, high performance, outside-React accessibility |
| **Native Android Layer** | **Kotlin + Java** | Required for Android services (`AccessibilityService`, `VoiceInteractionService`) |
| **Bridge Technology** | **TurboModules / JSI** | High-performance synchronous and asynchronous native bridge |
| **Local Storage** | **MMKV + SQLite** | Ultra-fast key-value store (<1ms) + relational query store |
| **Wake Word Engine** | **Porcupine / OpenWakeWord**| Ultra-low power continuous on-device audio keyword detection |
| **Speech-to-Text (STT)** | **Sherpa-ONNX / Whisper** | High accuracy, on-device streaming capability |
| **Text-to-Speech (TTS)** | **Pocket-TTS / KittenTTS** | CPU-efficient, streaming audio, natural voice, zero GPU requirement |
| **Fast LLM Provider** | **Groq (Llama 3.3 70B / 8B)**| Sub-250ms Time-to-First-Token (TTFT) for instant response |
| **Fallback LLMs** | **NVIDIA NIM / DeepSeek / Ollama** | Flexible OpenAI-compatible model provider abstraction |
| **Backend Framework** | **FastAPI (Python 3.12+)** | Async web sockets, lightweight deployment on personal VPS |
| **Containerization** | **Docker + Docker Compose** | Simple, reproducible VPS deployment independent of laptop |

---

## 2. Key NPM Packages & Libraries

```json
{
  "dependencies": {
    "react": "18.3.1",
    "react-native": "0.76.0",
    "zustand": "^5.0.0",
    "@react-navigation/native": "^7.0.0",
    "react-native-mmkv": "^3.1.0",
    "react-native-reanimated": "^3.16.0",
    "react-native-gesture-handler": "^2.20.0",
    "react-native-svg": "^15.8.0",
    "axios": "^1.7.0",
    "zod": "^3.23.0"
  }
}
```