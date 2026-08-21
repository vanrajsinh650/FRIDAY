# FRIDAY — System Architecture

---

## 1. End-to-End System Diagram

```
+---------------------------------------------------------------------------------------+
|                                    ANDROID DEVICE                                     |
|                                                                                       |
|   +-------------------------------------------------------------------------------+   |
|   |                         REACT NATIVE APPLICATION                              |   |
|   |                                                                               |   |
|   |   +-------------------+    +--------------------+    +--------------------+   |   |
|   |   |    HUD Overlay    |    |  Zustand App State |    |  Permission Engine |   |   |
|   |   +---------+---------+    +---------+----------+    +---------+----------+   |   |
|   |             |                        |                         |              |   |
|   |             +------------------------+-------------------------+              |   |
|   |                                      |                                        |   |
|   |                        +-------------v-------------+                          |   |
|   |                        |     FRIDAY AGENT CORE     |                          |   |
|   |                        |  (TypeScript Agent Loop)  |                          |   |
|   |                        |                           |                          |   |
|   |                        |  • Planner  • Tool Reg    |                          |   |
|   |                        |  • Verifier • Context Mgr |                          |   |
|   |                        +-------------+-------------+                          |   |
|   +--------------------------------------|----------------------------------------+   |
|                                          | TurboModule / Native Bridge                |
|   +--------------------------------------v----------------------------------------+   |
|   |                        ANDROID NATIVE MODULES LAYER                           |   |
|   |                                                                               |   |
|   |  +--------------------+  +--------------------+  +-------------------------+  |   |
|   |  | AccessibilityModule|  | VoiceInteractModule|  | ScreenCaptureModule     |  |   |
|   |  +---------+----------+  +---------+----------+  +------------+------------+  |   |
|   |  | NotificationModule |  | SystemControlModule|  | SchedulerModule         |  |   |
|   |  +---------+----------+  +---------+----------+  +------------+------------+  |   |
|   +------------|-----------------------|--------------------------|---------------+   |
|                |                       |                          |                   |
|   +------------v-----------------------v--------------------------v---------------+   |
|   |                               ANDROID OS                                      |   |
|   |   • AccessibilityService  • VoiceInteractionService  • MediaProjection        |   |
|   |   • PackageManager        • AlarmManager / WorkMgr   • AudioManager           |   |
|   +-------------------------------------------------------------------------------+   |
+------------------------------------------+--------------------------------------------+
                                           | Secure TLS / WebSockets
                                           v
+---------------------------------------------------------------------------------------+
|                              REMOTE CLOUD / VPS BRAIN                                 |
|                                                                                       |
|   +---------------------+   +---------------------+   +---------------------------+   |
|   |  FastAPI Gateway    |   | Model Provider Hub  |   | Persistent Memory Sync    |   |
|   |  (Auth & Routing)   |   | (Groq / NVIDIA NIM) |   | (PostgreSQL / SQLite)     |   |
|   +---------------------+   +---------------------+   +---------------------------+   |
+---------------------------------------------------------------------------------------+
```

---

## 2. Control Flow: Deterministic vs. Agentic Tasks

```text
User Input: "Open YouTube"                     User Input: "Find funniest Taarak Mehta episode"
             │                                                         │
             ▼                                                         ▼
Intent: Exact App Launch Match                           Intent: Multi-Step Exploratory Task
             │                                                         │
             ▼                                                         ▼
Direct Local Dispatch (0ms LLM cost)                     Agent Core: Formulate Initial Plan
             │                                                         │
             ▼                                                         ▼
Android PackageManager Intent Launch                     Step 1: Launch YouTube App
             │                                                         │
             ▼                                                         ▼
Video App Foregrounded (<300ms)                          Step 2: Inspect Accessibility Tree
                                                                       │
                                                                       ▼
                                                         Step 3: Type Search & Submit
                                                                       │
                                                                       ▼
                                                         Step 4: Rank Results & Tap Optimal
                                                                       │
                                                                       ▼
                                                         Step 5: Verify Playback & Confirm
```

---

## 3. Layer Responsibilities & Data Contracts

1. **Presentation Layer (React Native):** Owns UI state, animations, microphone visualizer, debug telemetry displays, and user settings.
2. **Agent Core Layer (TypeScript):** Orchestrates the `OBSERVE -> REASON -> PLAN -> ACT -> VERIFY` loop.
3. **Native Bridge Layer (Java/Kotlin):** Translates high-level TypeScript commands (`tap(x, y)`, `inspectScreen()`, `launchApp(pkg)`) into low-level Android system calls.
4. **Cloud / VPS Brain Layer:** Provides ultra-fast LLM inference via Groq/NVIDIA APIs and synchronizes persistent long-term memory across devices.