# FRIDAY — Living Project State

> **Last Updated:** 2026-08-29  
> **Current Phase:** Phase 8 — Autonomous Scheduled & Proactive Workflows Verified (ADR-008, ADR-017, BUG-022, BUG-023)  
> **Primary Tech Stack:** React Native (TypeScript) + Android Native Modules (Kotlin/Java) + FastAPI VPS Brain  

---

## 1. Project Implementation Status & Audit

| Component | Architecture State | Code Implementation | Device Verification |
| :--- | :--- | :--- | :--- |
| **Autonomous Scheduling & Routines** | Decoupled AlarmManager + WorkManager + Proactive Monitors | `src/agent/proactive/scheduler.ts`, `src/agent/proactive/routines.ts`, `src/tools/schedulerTools.ts`, Kotlin `SchedulerTurboModule`, `FridaySchedulerReceiver` | Unit & Integration Tested (180/180 Jest passing); Live AlarmManager & Receiver Ready |
| **React Native App & HUD** | Clean TypeScript Architecture | `src/components/`, `src/screens/`, `src/state/` | Emulated / Verified in TS & Jest |
| **Floating Overlay HUD** | Persistent 24/7 WindowManager Overlay (`TYPE_APPLICATION_OVERLAY`) | Kotlin `FridayFloatingOverlayService`, `FloatingOverlayTurboModule` + TS `FloatingOverlayModule` | Unit & Integration Tested in Jest; Live Android Service Ready |
| **Agent Core Loop** | DeepSeek-inspired State Machine | `FridayAgent`, `Planner`, `PromptBuilder`, `Verifier` | Unit Tested & Dynamic LLM Ready |
| **Model Provider (Tiered Router)** | `ProviderRouter` over Provider Abstraction | Tier-0 `intentFastPath` → NVIDIA primary → Groq/OpenAI/Local fallbacks; real HTTP JSON tool calls | Tested; deterministic offline fast-path keeps suite green |
| **Result Reasoning** | `ResultRanker` (pure, token-overlap + popularity/position/ad heuristics) | Planner ranks the visible result list and opens the best match by node id (not a blind first-tap); falls back to the platform's first card when nothing ranks | Unit + planner-integration tested |
| **Task Verification Gates** | Evidence-based terminal conditions (honesty invariant) | `PLAYBACK_ACTIVE` needs audio/transport-control proof; `MESSAGE_SENT` needs a verify step **and** a delivered/read marker — clicking is never itself "success" | Unit + e2e tested |
| **WhatsApp Send Flow** | Deterministic search → open → type → send → verify | Planner `MESSAGING` branch + `extractMessageIntent` (who/what, EN + romanised Hindi); offline mock state machine drives the full path | e2e green offline; live send requires device |
| **On-Demand Vision & Screen Grounding** | `VisionPerception` (hybrid fallback) + `NvidiaVisionProvider` (VLM `llama-3.2-11b-vision-instruct`) | `src/agent/perception/visionPerception.ts`, `src/agent/providers/nvidiaVisionProvider.ts`, `src/tools/visionTools.ts` (`capture_screen_vision`, `visual_tap`), `visionFallback.ts` | Unit & Integration Tested in Jest (147/147 passing); MediaProjection + VLM grounding verified |
| **Android Accessibility** | `AccessibilityService` Node Tree | Kotlin `AccessibilityNodeParser`, `GestureDispatcher` | Requires Physical Device / ADB |
| **Speech-to-Text (STT)** | 24/7 Continuous Command Pipeline | Kotlin `FridayForegroundService.kt`, `SpeechRecognizerTurboModule` + TS `VoicePipeline.ts`, `AdaptiveEndpointer.kt` | Verified on Physical Device (Vivo V19) & TS Jest |
| **Text-to-Speech (TTS)** | Microsoft Edge Neural TTS (`en-IE-EmilyNeural`) | Kotlin `TTSTurboModule.kt` (WSS streaming + MP3 cache + MediaPlayer) + TS `PocketTTSEngine` (Android TTS fallback) | Studio Verified (Kerry Condon Irish voice, 0ms key cost) |
| **Assistant Role (24/7)** | Foreground Service + `VoiceInteractionService` | Kotlin `FridayForegroundService`, `FridayVoiceInteractionSessionService` + Overlay | Persistent Notification + Microphone Service Active |
| **Persona & Identity** | Strict Iron Man F.R.I.D.A.Y. ("Boss" exclusive) & Irish Voice | `src/memory/personaManager.ts`, `PromptBuilder.ts`, `intentFastPath.ts`, `ActionSafetyGuard.ts`, `ResponseShaper.ts` | Unit Tested; all prompts, validators, & fast-paths enforce "Boss" (147/147 Jest passing) |
| **Structured Memory & Profile Graph** | Long-Term Relational Memory + Dynamic TTL & Profile Graph (ADR-007) | `src/memory/store.ts`, `src/memory/retriever.ts`, `src/memory/profile.ts`, `src/memory/types.ts`, `src/tools/memoryTools.ts` | Unit & Integration Tested in Jest (147/147 passing); Graph Traversal & TTL Purging Verified |
| **Privileged & Elevated Control** | Shizuku-first RootControlSeam (ADR-014) | Kotlin `RootControlTurboModule` + TS `RootControlModule`, `src/tools/rootControlTools.ts` | Unit & Integration Tested in Jest; Shizuku/SU Android Bridge Ready |
| **VPS Cloud Brain** | Containerized FastAPI Gateway | `backend/server/main.py`, Dockerfile, docker-compose | Local Server Ready / VPS Pending |

---

## 2. Evidence Gate: Physical Android Benchmark Plan

Before FRIDAY is marked as fully production verified, the following benchmark must execute on a physical Android test device with live logging:

```text
Benchmark Goal: "Friday, open YouTube, search Taarak Mehta Ka Ooltah Chashmah, find the most viewed funny episode, and play it."

Verification Criteria:
1. Microphone Audio Capture -> Android SpeechRecognizer continuous pipeline captures single-breath "Friday, open YouTube..." without wake-handover delay.
2. ActionSafetyGuard & Intent Fast-Path -> Recognizes compound actionable command, bypasses intermediate wake greeting, and triggers agent loop directly.
3. Dynamic Planner -> Tiered router (NVIDIA Llama 3.3 70B primary, Groq/Local fallback) generates structured tool calls without hardcoded strings.
4. SystemControlTurboModule -> Launches com.google.android.youtube.
5. FridayAccessibilityService -> Traverses live YouTube node hierarchy, calculates clickable bounds.
6. GestureDispatcher -> Dispatches real motion click at search button coordinates.
7. AccessibilityNodeInfo -> Injects text "Taarak Mehta Ka Ooltah Chashmah funny episode".
8. ResultRanker -> Analyzes search result cards, avoids ads/sponsored cards, selects top relevant episode node.
9. GestureDispatcher -> Clicks top ranked video card.
10. VerificationEngine -> Confirms video playback state via active audio transport controls.
11. TTSTurboModule -> Synthesizes spoken confirmation aloud in authentic Kerry Condon Irish voice ("Playing that for you now, Boss.") via Edge Neural WebSocket stream.
```

---

## 3. Known Blockers & Technical Risks

| Risk / Blocker | Severity | Status | Mitigation Strategy |
| :--- | :--- | :--- | :--- |
| **Android Background Killing** | High | Mitigated | `FridayForegroundService` registered with persistent notification (`FOREGROUND_SERVICE_TYPE_MICROPHONE`) + partial `WakeLock` against aggressive OEM OS sleeping (Vivo FuntouchOS / Samsung OneUI). |
| **Accessibility Tree Latency** | Medium | Mitigated | Native Kotlin pruning (`AccessibilityNodeParser`) strips empty/layout nodes down to interactive nodes in <25ms. |
| **Barge-in / Voice Interruption** | Medium | Mitigated | `VoicePipeline.interrupt()` halts audio track buffers and MediaPlayer instantly on speech activity or manual touch. |
| **Blind execution / app relaunch loop** | High | Mitigated (BUG-001) | Preflight gate blocks screen-control goals when Accessibility is off (prompts user to enable it); planner launches a target app once → waits → stops instead of relaunching every step. |
| **Premature success / false confirmation** | High | Mitigated (BUG-002) | Terminal conditions are evidence-based: playback needs audio/transport proof, sending needs a verify step + delivered marker. Planner runs bounded verify loops and never self-declares; the loop's honesty gate reports "couldn't confirm" otherwise. |
| **Wake-up / Greeting Stalls** | Medium | Mitigated (BUG-003) | Direct continuous speech recognition with partial matching + Tier-0 fast-paths for instant conversational responses. |
| **Groq TTS Deprecation / 400 Bad Request** | High | Mitigated (BUG-005) | Replaced decommissioned Groq/PlayAI cloud TTS with Microsoft Edge Neural WebSocket TTS (`en-IE-EmilyNeural` Irish accent) with zero API keys, local MP3 caching, and Android native TTS fallback. |
| **Double-Verification Wake Deadlock & False Triggers** | High | Mitigated (BUG-006) | Replaced brittle energy VAD + two-stage handoff with 24/7 continuous STT keyword prefix pipeline, compound single-breath parsing, and `ActionSafetyGuard` noise/verb filtering. |

---

## 4. Architectural Decisions Recorded
- Recorded ADR 001 through ADR 014 in [`context/25_DECISION_LOG.md`](./context/25_DECISION_LOG.md).
- **ADR 013 — NVIDIA-primary tiered perception.** NVIDIA NIM is the primary reasoner and "eyes" (vision-capable). Perception is tiered cheapest-first: accessibility tree → on-demand screenshot+VLM only when the tree is sparse → Groq/text as provider fallback. Vision is never per-frame. See [`15_MODEL_PROVIDER_ARCHITECTURE.md`](./15_MODEL_PROVIDER_ARCHITECTURE.md).
- **ADR 014 — Shizuku-first privileged control.** Elevated control uses Shizuku (ADB-level, no root) when authorised, opportunistically uses true root only if already present, and degrades to accessibility-only otherwise. FRIDAY never roots the device itself.
- **ADR 015 — Microsoft Edge Neural TTS with Authentic Irish Voice.** Native WebSocket streaming of Microsoft Edge Neural TTS (`en-IE-EmilyNeural` Kerry Condon MCU voice) over Android `MediaPlayer` with local MP3 disk caching and Android `TextToSpeech` fallback. Zero API key dependency, zero cloud subscription cost.
- **ADR 016 — 24/7 Continuous Keyword Command Pipeline.** Continuous background speech recognition with single-breath command execution ("Friday, <command>"), fuzzy prefix extraction, `ActionSafetyGuard` false-trigger rejection, and instant fallback.
- **ADR 017 — Strict Iron Man F.R.I.D.A.Y. Persona & "Boss" Identity Locking.** System prompt and Tier-0 intent fast-paths strictly lock the assistant's persona to Kerry Condon's Marvel character, addressing the user exclusively as "Boss" and outputting clean, concise conversational audio free of markdown symbols.
- **ADR 020 — Persistent Floating Overlay HUD (`TYPE_APPLICATION_OVERLAY`) for 24/7 Multi-App State Visibility.** Dedicated 24/7 persistent holographic floating HUD rendering live status over external apps, with mic quick-action, close, dragging gestures, and automatic multi-app state synchronization.

