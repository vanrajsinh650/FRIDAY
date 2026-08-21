# FRIDAY — Living Project State

> **Last Updated:** 2026-08-21  
> **Current Phase:** Phase 0 — Foundation & Context Hub Setup  
> **Primary Tech Stack:** React Native (TypeScript) + Android Native Modules (Kotlin/Java)  

---

## 1. Project Phase Overview

```text
[X] Phase 0: Foundation & Context Hub Setup (COMPLETED)
[ ] Phase 1: Local Voice Stack (Wake Word, STT, Pocket-TTS) (NEXT)
[ ] Phase 2: Fast Native Phone Actions (Intents, System Controls, Alarms)
[ ] Phase 3: Accessibility Engine & UI Automation (Node Tree, Gestures, Text)
[ ] Phase 4: Agentic Loop & Multi-Step Verification (Plan -> Act -> Verify)
[ ] Phase 5: Vision Fallback Integration (MediaProjection + Visual Grounding)
[ ] Phase 6: Structured Personal Memory (User Profile, Fact Store)
[ ] Phase 7: 24/7 Voice Assistant Integration (VoiceInteractionService)
[ ] Phase 8: Advanced Autonomy & Proactive Workflows
```

---

## 2. Active Work & Immediate Next Steps

1. **Active Task:** Complete verification of all 31 `/context` hub files.
2. **Next Step (Phase 0 -> Phase 1):**
   - Initialize React Native 0.76+ TypeScript project structure (`package.json`, `tsconfig.json`, `src/`).
   - Configure Android Native project with Kotlin support and initial TurboModule bridge skeletons.
   - Integrate Porcupine wake-word engine and Sherpa-ONNX / Whisper STT bridge.
   - Benchmark Pocket-TTS vs. KittenTTS on Android test device.

---

## 3. Known Blockers & Technical Risks

| Risk / Blocker | Severity | Mitigation Strategy |
| :--- | :--- | :--- |
| **Android Background Kill:** OEM battery managers killing background services | High | Implement Foreground Service with persistent notification + request `ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`. |
| **Accessibility Node Tree Parsing Latency:** Complex 1000+ node apps causing lag | Medium | Implement native Kotlin tree pruning to filter empty/invisible nodes in <25ms. |
| **Voice Interruption / Barge-in:** Latency when stopping TTS playback during user speech | Medium | Dedicated native audio buffer flush on instant voice activity detection (VAD). |

---

## 4. Architectural Decisions Recorded Today
- ADR-001 through ADR-012 recorded in [`context/25_DECISION_LOG.md`](./context/25_DECISION_LOG.md).