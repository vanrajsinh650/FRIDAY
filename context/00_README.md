# FRIDAY Context Hub — Master Index & Architecture Overview

> **Version:** 1.0.0  
> **Status:** Active / Authoritative  
> **Primary Technology Stack:** React Native (TypeScript) + Android Native Modules (Java/Kotlin) + Hybrid Cloud Agent Brain  
> **Target Audience:** Human Developers, AI Coding Agents, Architecture Reviewers  

---

## 1. Executive Summary & Purpose

This `/context` hub serves as the **Single Source of Truth (SSOT)** for **FRIDAY** — a personal Android AI operating layer designed to operate the user's phone autonomously through natural voice commands, structured accessibility automation, and intelligent reasoning.

Unlike traditional chatbots or voice assistants with hardcoded commands, FRIDAY functions as an autonomous agent that can **observe the phone screen, reason about high-level goals, plan actions, execute multi-step UI gestures/intents, and verify outcomes** without requiring manual per-app API integrations.

---

## 2. Master Table of Contents

| File | Title | Core Subject / Scope |
| :--- | :--- | :--- |
| [`00_README.md`](./00_README.md) | **Master Index & Overview** | Navigation hub, reading guide, context maintenance rules |
| [`01_PRODUCT_VISION.md`](./01_PRODUCT_VISION.md) | **Product Vision** | Long-term vision, Iron Man inspiration, operating philosophy |
| [`02_PRODUCT_REQUIREMENTS.md`](./02_PRODUCT_REQUIREMENTS.md) | **Product Requirements** | Functional & non-functional requirements, latency budgets, KPIs |
| [`03_PROJECT_SCOPE.md`](./03_PROJECT_SCOPE.md) | **Project Scope** | In-scope vs. out-of-scope boundaries for 1 user / 2-3 devices |
| [`04_SYSTEM_ARCHITECTURE.md`](./04_SYSTEM_ARCHITECTURE.md) | **System Architecture** | End-to-end multi-tier system diagrams and data flow |
| [`05_TECH_STACK.md`](./05_TECH_STACK.md) | **Technology Stack** | React Native, TypeScript, Android Modules, Groq, Pocket-TTS |
| [`06_REPOSITORY_STRUCTURE.md`](./06_REPOSITORY_STRUCTURE.md) | **Repository Structure** | Monorepo layout, file conventions, module boundaries |
| [`07_REACT_NATIVE_ARCHITECTURE.md`](./07_REACT_NATIVE_ARCHITECTURE.md) | **React Native Architecture** | App structure, state management, TurboModules, Headless JS |
| [`08_ANDROID_NATIVE_MODULES.md`](./08_ANDROID_NATIVE_MODULES.md) | **Android Native Modules** | Bridge specifications for Accessibility, Voice, Notifications, System |
| [`09_AGENT_ARCHITECTURE.md`](./09_AGENT_ARCHITECTURE.md) | **Agent Architecture** | Agent loop, DeepSeek Harness inspiration, Planner, Verifier |
| [`10_VOICE_ARCHITECTURE.md`](./10_VOICE_ARCHITECTURE.md) | **Voice Architecture** | Wake word, STT, Pocket-TTS/KittenTTS, audio streaming pipeline |
| [`11_PHONE_CONTROL_ARCHITECTURE.md`](./11_PHONE_CONTROL_ARCHITECTURE.md) | **Phone Control Layer** | Hybrid execution hierarchy, deterministic actions, dispatching |
| [`12_ACCESSIBILITY_ARCHITECTURE.md`](./12_ACCESSIBILITY_ARCHITECTURE.md) | **Accessibility Architecture**| `AccessibilityService`, node tree parsing, gesture dispatch |
| [`13_VISION_FALLBACK.md`](./13_VISION_FALLBACK.md) | **Vision Fallback** | `MediaProjection`, visual grounding, coordinate mapping |
| [`14_BACKEND_ARCHITECTURE.md`](./14_BACKEND_ARCHITECTURE.md) | **Backend Architecture** | Remote VPS agent server, memory sync, zero-laptop dependency |
| [`15_MODEL_PROVIDER_ARCHITECTURE.md`](./15_MODEL_PROVIDER_ARCHITECTURE.md) | **Model Provider Layer** | LLM abstraction (Groq, NVIDIA NIM, OpenAI-compatible, Local) |
| [`16_MEMORY_ARCHITECTURE.md`](./16_MEMORY_ARCHITECTURE.md) | **Memory Architecture** | Structured local/cloud profile, SQLite/MMKV, scoped retrieval |
| [`17_SCHEDULING_ARCHITECTURE.md`](./17_SCHEDULING_ARCHITECTURE.md) | **Scheduling Architecture** | Decoupled `AlarmManager` + `WorkManager` background execution |
| [`18_PERMISSION_ARCHITECTURE.md`](./18_PERMISSION_ARCHITECTURE.md) | **Permission Architecture** | Centralized permissions, Special Access, onboarding flow |
| [`19_SECURITY.md`](./19_SECURITY.md) | **Security Architecture** | Secret isolation, high-impact action gates, threat boundaries |
| [`20_PERFORMANCE.md`](./20_PERFORMANCE.md) | **Performance Engineering** | Latency budgets, TTFT/TTFA targets, battery/RAM limits |
| [`21_OBSERVABILITY.md`](./21_OBSERVABILITY.md) | **Observability & Logging** | Structured telemetry events, React Native Debug HUD overlay |
| [`22_TESTING_STRATEGY.md`](./22_TESTING_STRATEGY.md) | **Testing Strategy** | Unit, integration, ADB instrumentation, E2E benchmarks |
| [`23_DEPLOYMENT.md`](./23_DEPLOYMENT.md) | **Deployment & Release** | Android APK sideloading, VPS Docker setup, configuration |
| [`24_PROJECT_ROADMAP.md`](./24_PROJECT_ROADMAP.md) | **Project Roadmap** | Phase 0 to Phase 8 milestone breakdown and exit criteria |
| [`25_DECISION_LOG.md`](./25_DECISION_LOG.md) | **Architectural Decision Log**| ADR 001 to ADR 012 recording all foundational choices |
| [`PROJECT_STATE.md`](./PROJECT_STATE.md) | **Living Project State** | Active phase, completed tasks, blockers, technical debt |
| [`BUG_TRACKER.md`](./BUG_TRACKER.md) | **Defect Tracking Log** | Issue log, severity ratings, reproduction and verification |
| [`THREAT_MODEL.md`](./THREAT_MODEL.md) | **Threat Model** | STRIDE analysis, attack surfaces, prompt injection mitigations |
| [`SECURITY_INVARIANTS.md`](./SECURITY_INVARIANTS.md) | **Security Invariants** | 10 non-negotiable security rules for autonomous phone use |
| [`SECURITY_RUNBOOK.md`](./SECURITY_RUNBOOK.md) | **Security Runbook** | Incident triage, emergency kill-switch, credential rotation |

---

## 3. Reading Guides by Role

### For React Native & Mobile Engineers
Start with:
1. [`01_PRODUCT_VISION.md`](./01_PRODUCT_VISION.md)
2. [`07_REACT_NATIVE_ARCHITECTURE.md`](./07_REACT_NATIVE_ARCHITECTURE.md)
3. [`08_ANDROID_NATIVE_MODULES.md`](./08_ANDROID_NATIVE_MODULES.md)
4. [`18_PERMISSION_ARCHITECTURE.md`](./18_PERMISSION_ARCHITECTURE.md)

### For AI Agent & LLM Engineers
Start with:
1. [`09_AGENT_ARCHITECTURE.md`](./09_AGENT_ARCHITECTURE.md)
2. [`11_PHONE_CONTROL_ARCHITECTURE.md`](./11_PHONE_CONTROL_ARCHITECTURE.md)
3. [`15_MODEL_PROVIDER_ARCHITECTURE.md`](./15_MODEL_PROVIDER_ARCHITECTURE.md)
4. [`16_MEMORY_ARCHITECTURE.md`](./16_MEMORY_ARCHITECTURE.md)

### For Android Systems Engineers
Start with:
1. [`08_ANDROID_NATIVE_MODULES.md`](./08_ANDROID_NATIVE_MODULES.md)
2. [`12_ACCESSIBILITY_ARCHITECTURE.md`](./12_ACCESSIBILITY_ARCHITECTURE.md)
3. [`17_SCHEDULING_ARCHITECTURE.md`](./17_SCHEDULING_ARCHITECTURE.md)
4. [`10_VOICE_ARCHITECTURE.md`](./10_VOICE_ARCHITECTURE.md)

---

## 4. Context Hub Governance & Maintenance

- **Never create undocumented architecture:** Any new module, service, or pattern must be documented in its respective context file.
- **Update Living State:** Whenever work finishes, updates MUST be recorded in [`PROJECT_STATE.md`](./PROJECT_STATE.md).
- **Log Decisions:** Architectural pivots must be written as an ADR in [`25_DECISION_LOG.md`](./25_DECISION_LOG.md).
- **Track Bugs:** Every non-trivial issue must be recorded in [`BUG_TRACKER.md`](./BUG_TRACKER.md).