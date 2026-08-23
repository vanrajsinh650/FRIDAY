# FRIDAY — Project Scope & System Boundaries

---

## 1. Target Audience & Deployment Target

- **Primary User:** 1 primary user (personal AI assistant).
- **Device Footprint:** 2 to 3 personal Android devices (Android 11+ / API Level 30+).
- **Design Philosophy:** Highly tailored, responsive, zero unnecessary enterprise bloat.

---

## 2. In-Scope Work

```text
┌───────────────────────────────────────────────────────────────────────────────────────────┐
│                                     IN-SCOPE CAPABILITIES                                 │
├────────────────────────────┬─────────────────────────────┬────────────────────────────────┤
│ 1. React Native App        │ 2. Android Native Modules   │ 3. Agent & Backend Core        │
├────────────────────────────┼─────────────────────────────┼────────────────────────────────┤
│ • Modern React Native 0.76 │ • AccessibilityService      │ • TypeScript Agent Core        │
│ • TypeScript architecture  │ • VoiceInteractionService   │ • DeepSeek Harness patterns    │
│ • Zustand / Redux state    │ • ForegroundService         │ • Groq Llama 3.3 70B fast LLM  │
│ • Holographic HUD UI       │ • MediaProjection (Vision)  │ • Model Provider abstraction   │
│ • Voice audio visualizer   │ • NotificationListener      │ • Structured SQLite memory     │
│ • Debug Telemetry HUD      │ • WorkManager + AlarmMgr    │ • Remote VPS server (Docker)   │
└────────────────────────────┴─────────────────────────────┴────────────────────────────────┘
```

---

## 3. Explicit Out-of-Scope (Initial Releases)

1. **Multi-Tenant SaaS Infrastructure:** No complex multi-user authentication, billing, or enterprise team hierarchies.
2. **Remote Phone Screen Streaming:** The backend does NOT stream video or remote-control the phone from the cloud; reasoning plans are generated and executed locally on-device.
3. **Kernel Exploits & Mandatory Root:** No dependence on kernel exploits, and root is **never required**. Automation is built on legitimate Android APIs (`AccessibilityService`, `VoiceInteractionService`) first. Elevated control is obtained through a **Shizuku-first `RootControl`** seam: it uses Shizuku (ADB-level privileges, no root, no unlock, near-zero brick risk) when the user has authorised it, and *opportunistically* uses true root only if it already happens to be present at runtime. FRIDAY never installs Magisk/KernelSU or roots the device itself — it stays device-agnostic and degrades gracefully to accessibility-only when neither is available.
4. **Heavy Unstructured Vector DBs:** No embedding millions of vectors on-device; structured SQLite + keyword indexing is used for memory.
5. **Mandatory Laptop Pairing:** The user will NEVER need their development laptop running to use FRIDAY in daily life.

---

## 4. Future Evolution (Phases 6–8)

- **On-Device SLM (Small Language Models):** Deploying 1B-3B parameter quantized models (e.g. Phi-3.5 Mini, Gemma-2 2B) via ExecuTorch / ONNX Runtime on NPU for offline reasoning.
- **Proactive Contextual Agents:** Suggesting actions based on calendar events, incoming notifications, and location triggers.
- **Multi-Device Relay:** Synchronizing memory and scheduled reminders seamlessly across phone and tablet.