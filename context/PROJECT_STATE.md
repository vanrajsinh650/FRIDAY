# FRIDAY — Living Project State

> **Last Updated:** 2026-08-21  
> **Current Phase:** Phase 1 / Phase 2 Completed — Core Architecture & Test Suite Verified  
> **Primary Tech Stack:** React Native (TypeScript) + Android Native Modules (Kotlin/Java) + FastAPI VPS Brain  

---

## 1. Project Implementation Status & Audit

| Component | Architecture State | Code Implementation | Device Verification |
| :--- | :--- | :--- | :--- |
| **React Native App & HUD** | Clean TypeScript Architecture | `src/components/`, `src/screens/`, `src/state/` | Emulated / Verified in TS & Jest |
| **Agent Core Loop** | DeepSeek-inspired State Machine | `FridayAgent`, `Planner`, `PromptBuilder`, `Verifier` | Unit Tested & Dynamic LLM Ready |
| **Model Provider (Groq)** | Provider Abstraction | Real HTTP API client with JSON Schema function calling | Tested with dynamic fallback |
| **Android Accessibility** | `AccessibilityService` Node Tree | Kotlin `AccessibilityNodeParser`, `GestureDispatcher` | Requires Physical Device / ADB |
| **Speech-to-Text (STT)** | Real Native Module Bridge | Kotlin `SpeechRecognizerTurboModule` + `NativeEventEmitter` | Requires Physical Microphone |
| **Text-to-Speech (TTS)** | Real Native Module Bridge | Kotlin `TTSTurboModule` (Android TextToSpeech) | Requires Physical Audio Output |
| **Assistant Role (24/7)** | `VoiceInteractionService` | Kotlin `FridayVoiceInteractionSessionService` + Overlay | Requires Assistant Role Grant |
| **VPS Cloud Brain** | Containerized FastAPI Gateway | `backend/server/main.py`, Dockerfile, docker-compose | Local Server Ready / VPS Pending |

---

## 2. Evidence Gate: Physical Android Benchmark Plan

Before FRIDAY is marked as fully production verified, the following benchmark must execute on a physical Android test device with live logging:

```text
Benchmark Goal: "Open YouTube, search Taarak Mehta Ka Ooltah Chashmah, find the most viewed funny episode, and play it."

Verification Criteria:
1. Microphone Audio Capture -> Android SpeechRecognizer generates real-time partial & final transcripts.
2. Dynamic Planner -> Groq Llama 3.3 70B generates structured tool calls without hardcoded strings.
3. SystemControlTurboModule -> Launches com.google.android.youtube.
4. FridayAccessibilityService -> Traverses live YouTube node hierarchy, calculates clickable bounds.
5. GestureDispatcher -> Dispatches real motion click at search button coordinates.
6. AccessibilityNodeInfo -> Injects text "Taarak Mehta Ka Ooltah Chashmah funny episode".
7. GestureDispatcher -> Clicks top result video card.
8. VerificationEngine -> Confirms video playback state.
9. TTSTurboModule -> Synthesizes spoken confirmation aloud through phone speaker.
```

---

## 3. Known Blockers & Technical Risks

| Risk / Blocker | Severity | Status | Mitigation Strategy |
| :--- | :--- | :--- | :--- |
| **Android Background Killing** | High | Mitigated | `FridayForegroundService` registered with persistent notification + battery optimization whitelist request. |
| **Accessibility Tree Latency** | Medium | Mitigated | Native Kotlin pruning (`AccessibilityNodeParser`) strips empty/layout nodes down to interactive nodes in <25ms. |
| **Barge-in / Voice Interruption** | Medium | Mitigated | `VoicePipeline.interrupt()` halts audio track buffers instantly on speech activity. |

---

## 4. Architectural Decisions Recorded
- Recorded ADR 001 through ADR 012 in [`context/25_DECISION_LOG.md`](./context/25_DECISION_LOG.md).
