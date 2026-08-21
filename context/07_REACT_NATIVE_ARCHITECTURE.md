# FRIDAY — React Native Architecture & UI Layer

---

## 1. Application Layer Overview

FRIDAY uses **React Native (0.76+) with TypeScript** as its primary application framework. React Native manages the user interface, presentation state, agent coordination, voice orchestration, and audio feedback.

### Core Architectural Rules:
1. **React Native is the Boss:** All business logic, agent decision flow, and UI rendering live in React Native/TypeScript.
2. **Native Code is a Supporting Capability:** Kotlin/Java code exists solely to expose Android OS subsystems (Accessibility, VoiceInteraction, Foreground Services, MediaProjection) via clean TurboModule interfaces.
3. **No Direct Kotlin Frontend:** The UI is 100% built using React Native + React Native Reanimated.

---

## 2. Component Hierarchy & HUD Visual Layer

The visual design is inspired by Iron Man's F.R.I.D.A.Y. HUD — featuring an interactive, reactive holographic orb, real-time voice waveforms, and floating action status indicators.

```text
AppContainer (Root Provider, SafeAreaProvider)
 ├── NavigationContainer
 │    ├── AssistantHUD (Primary Floating / Fullscreen View)
 │    │    ├── HolographicOrb (Reanimated 3D Particle/Pulse Visualizer)
 │    │    ├── VoiceWaveform (Real-time RMS Audio Level Indicator)
 │    │    ├── AgentStatusBanner ("Observing screen...", "Executing search...")
 │    │    ├── ActionStreamLog (Real-time step-by-step progress cards)
 │    │    └── VoiceTranscriptView (Streaming User speech & FRIDAY replies)
 │    ├── SettingsScreen (Voice model selection, VPS server URL, API keys)
 │    ├── MemoryManagerScreen (View, edit, delete stored personal facts)
 │    └── DebugTelemetryScreen (Live node tree inspector, TTFT/TTFA latency gauges)
 └── SystemOverlayController (Floating overlay when interacting with external apps)
```

---

## 3. State Management Architecture (Zustand)

FRIDAY utilizes modular **Zustand** stores designed to be accessible both inside React components and directly from asynchronous agent background loops:

```typescript
// src/state/agentStore.ts
export type AgentState = 'IDLE' | 'LISTENING' | 'THINKING' | 'EXECUTING' | 'VERIFYING' | 'SPEAKING' | 'ERROR';

interface AgentStore {
  state: AgentState;
  activeGoal: string | null;
  currentStep: string | null;
  stepHistory: Array<{ step: string; status: 'pending' | 'success' | 'failed'; timestamp: number }>;
  isVoiceActive: boolean;
  setAgentState: (state: AgentState) => void;
  setActiveGoal: (goal: string | null) => void;
  addStep: (step: string) => void;
  updateStepStatus: (index: number, status: 'pending' | 'success' | 'failed') => void;
  reset: () => void;
}
```

---

## 4. Headless JS & Background Execution

When the phone screen is off or FRIDAY is operating an external third-party application (e.g. YouTube, WhatsApp), the agent runs in background mode:
- **Android Foreground Service** keeps the process alive with low-priority notification.
- **React Native Headless JS** executes agent task pipelines triggered by voice wake words or `AlarmManager` broadcasts without requiring the full React UI to be foregrounded.
- **Floating Overlay HUD:** A non-intrusive floating pill or edge glow provides visual feedback on task progress while external apps are on screen.