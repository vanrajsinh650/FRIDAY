# FRIDAY — Voice Pipeline Architecture

---

## 1. End-to-End Streaming Voice Pipeline

The voice stack is designed for minimum latency and natural conversational fluidity.

```text
Microphone Input
      │
      ▼
Porcupine / OpenWakeWord (On-Device, <100ms)
      │ "Hey Friday" detected
      ▼
Audio Stream Buffering
      │
      ▼
Streaming STT (Sherpa-ONNX / Whisper Streaming, <200ms TTFT)
      │
      ▼
FRIDAY Agent Core (Intent parsing & tool plan)
      │
      ▼ (Text chunks stream out)
Pocket-TTS / KittenTTS Engine (On-device / low-latency CPU, <150ms)
      │
      ▼
AudioTrack Stream Playback (User hears voice while action runs)
```

---

## 2. TTS Engine Evaluation: Pocket-TTS vs. KittenTTS

| Feature | Pocket-TTS (Kyutai) | KittenTTS | Android System TTS |
| :--- | :--- | :--- | :--- |
| **Execution** | CPU-first, zero GPU required | Lightweight CPU | Built-in OS engine |
| **Voice Quality** | Highly natural, expressive | Clean, robotic-neutral | Robotic / standard |
| **Streaming** | Native chunk streaming | Chunk streaming | Limited streaming |
| **Latency** | ~120-180ms to first audio | ~150-200ms | <100ms |
| **Verdict** | **Primary Engine** | Evaluation Fallback | Offline Emergency Fallback |

---

## 3. Graceful Interruption & Audio Focus

- **Audio Ducking:** Automatically lowers media volume when wake word is detected.
- **Barge-In (Interruption):** If the user speaks while FRIDAY is speaking, the TTS buffer is flushed instantly, halting audio output and switching immediately to listen mode.