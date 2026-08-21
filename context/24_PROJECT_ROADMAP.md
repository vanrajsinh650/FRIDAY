# FRIDAY — Project Roadmap & Phased Execution

---

## 1. Development Phases Overview

```text
Phase 0: Foundation & Context Hub Setup (Current)
    │
    ▼
Phase 1: Local Voice Stack (Wake Word, STT, Pocket-TTS)
    │
    ▼
Phase 2: Fast Native Phone Actions (Intents, System Controls, Alarms)
    │
    ▼
Phase 3: Accessibility Engine & UI Automation (Node Tree, Gestures, Text)
    │
    ▼
Phase 4: Agentic Loop & Multi-Step Verification (Plan -> Act -> Verify)
    │
    ▼
Phase 5: Vision Fallback Integration (MediaProjection + Visual Grounding)
    │
    ▼
Phase 6: Structured Personal Memory (User Profile, Fact Store, Scoped Retrieval)
    │
    ▼
Phase 7: 24/7 Voice Assistant Integration (VoiceInteractionService, Keepalive)
    │
    ▼
Phase 8: Advanced Autonomy & Proactive Workflows (Scheduled Work, Multi-App)
```

---

## 2. Phase Milestones & Exit Criteria

- **Phase 0 (Foundation):** React Native + Android template initialized, TurboModule bridge contracts compiled, context hub established.
- **Phase 1 (Voice):** "Hey Friday" wake word activates microphone, user speech converted to text in <200ms, Pocket-TTS streams audio response.
- **Phase 2 (Fast Actions):** App launch intents, volume/brightness controls, and system alarms execute deterministically in <500ms.
- **Phase 3 (Accessibility):** `FridayAccessibilityService` successfully clicks nodes, types into textboxes, and scrolls screens in third-party apps.
- **Phase 4 (Agentic Tasks):** YouTube search and play benchmark completes end-to-end without manual intervention.
- **Phase 5 (Vision):** Canvas/Flutter apps fallback to screenshot coordinate tapping.
- **Phase 6 (Memory):** User preferences remembered across sessions.
- **Phase 7 (24/7 Assistant):** Long-press home button / voice wake activates FRIDAY from lock screen or background.
- **Phase 8 (Advanced):** Autonomous scheduled morning briefings and cross-app tasks executed reliably.