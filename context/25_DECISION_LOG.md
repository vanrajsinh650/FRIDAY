# FRIDAY — Architectural Decision Log (ADR)

---

## ADR Index

| ADR | Title | Status | Date |
| :--- | :--- | :--- | :--- |
| **ADR-001** | React Native + TypeScript as Primary Application Architecture | **Accepted** | 2026-08-21 |
| **ADR-002** | Android Native Modules as Operating System Capability Layer | **Accepted** | 2026-08-21 |
| **ADR-003** | AccessibilityService as Primary UI Automation Engine | **Accepted** | 2026-08-21 |
| **ADR-004** | Pocket-TTS Selection for Lightweight CPU-First Speech Synthesis | **Accepted** | 2026-08-21 |
| **ADR-005** | Groq Llama 3.3 70B as Primary Fast Inference Provider | **Accepted** | 2026-08-21 |
| **ADR-006** | Hybrid Priority Hierarchy (Native > Accessibility > Vision) | **Accepted** | 2026-08-21 |
| **ADR-007** | Structured SQLite/MMKV Relational Memory over Heavy Vector DB | **Accepted** | 2026-08-21 |
| **ADR-008** | Decoupled AlarmManager + WorkManager Scheduling Architecture | **Accepted** | 2026-08-21 |
| **ADR-009** | Verification-First State Machine for Non-Hallucinatory Actions | **Accepted** | 2026-08-21 |
| **ADR-010** | Zero-Laptop Production Target (Standalone Android + VPS) | **Accepted** | 2026-08-21 |
| **ADR-011** | MediaProjection API as Selective Vision Fallback | **Accepted** | 2026-08-21 |
| **ADR-012** | VoiceInteractionService Integration for System Assistant Role | **Accepted** | 2026-08-21 |

---

### ADR-001: React Native + TypeScript as Primary Application Architecture
- **Context:** FRIDAY requires rapid cross-platform UI development, high-speed state management, and modern component composition while avoiding cumbersome pure-native boilerplate.
- **Decision:** Use React Native (0.76+) with TypeScript for the entire UI, state, agent coordination, and tool orchestration.
- **Consequences:** Native Android capabilities are accessed via TurboModule bridge interfaces rather than rewriting the application in Kotlin.

### ADR-003: AccessibilityService as Primary UI Automation Engine
- **Context:** Operating third-party Android apps requires reading screen content and dispatching touch gestures without root access.
- **Decision:** Implement `FridayAccessibilityService` to inspect the UI node hierarchy and call `dispatchGesture()`.
- **Consequences:** Requires the user to grant Accessibility permissions in Android Settings during onboarding.

### ADR-004: Pocket-TTS Selection for Lightweight CPU Speech Synthesis
- **Context:** FRIDAY needs low-latency, natural voice generation on mobile devices without relying on GPU servers.
- **Decision:** Select Pocket-TTS as the primary TTS engine due to its CPU-first architecture and chunked audio streaming.

### ADR-005: Groq Llama 3.3 70B as Primary Fast Inference Provider
- **Context:** To achieve <500ms time-to-first-action, the LLM must return initial tokens in under 250ms.
- **Decision:** Utilize Groq cloud inference with Llama 3.3 70B as the default reasoning provider, behind a provider abstraction interface.