# FRIDAY — Product Requirements & Specifications

---

## 1. Functional Requirements (FR)

### FR-1: Voice Interaction & Wake Pipeline
- **FR-1.1:** Continuous, low-power wake-word detection on-device (*"Hey Friday"* / *"Friday"*).
- **FR-1.2:** Low-latency streaming speech-to-text (STT) with first-result streaming within 250ms.
- **FR-1.3:** Natural speech synthesis (TTS) using lightweight local engines (Pocket-TTS / KittenTTS) with audio streaming support.
- **FR-1.4:** Graceful interruption: User speaking while FRIDAY is talking immediately halts audio playback.

### FR-2: Whole-Device Control & UI Automation
- **FR-2.1:** Launch any installed Android package via package manager intents.
- **FR-2.2:** Real-time UI inspection via `AccessibilityService` extracting visible text, content descriptions, clickable bounds, and node IDs.
- **FR-2.3:** Precision gesture dispatch: Tap, double-tap, long-press, swipe, drag, and scroll coordinates.
- **FR-2.4:** Text injection into input fields with IME / keyboard fallback.
- **FR-2.5:** Global hardware/system actions: Home, Back, Recent Apps, Volume, Brightness, Flashlight, Quick Settings.
- **FR-2.6:** Vision fallback using `MediaProjection` screen capture for non-standard UI (e.g. Canvas, Flutter, Games).

### FR-3: Multi-Step Agentic Workflow
- **FR-3.1:** Goal decomposition: Parse high-level natural language into ordered atomic actions.
- **FR-3.2:** State observation loop: Observe screen state before and after each action.
- **FR-3.3:** Verification assertions: Verify visual state changes (e.g., video playing, message sent bubble rendered).
- **FR-3.4:** Bounded retry and error recovery: Max 3 retries per step with alternate strategy before asking user.

### FR-4: Memory & Personalization
- **FR-4.1:** Local structured memory: User profile, preferences, frequently used apps, contacts, habits.
- **FR-4.2:** Scoped context retrieval: Inject only context relevant to the active goal to preserve token limits.
- **FR-4.3:** User memory management: User can inspect, edit, or delete any stored memory fact.

### FR-5: Scheduling & Autonomous Background Work
- **FR-5.1:** Set exact alarms and timers via Android `AlarmManager`.
- **FR-5.2:** Execute proactive tasks (e.g., morning briefing, calendar sync) using `WorkManager` without keeping LLM continuously active.

---

## 2. Non-Functional Requirements (NFR)

### NFR-1: Latency Budgets
| Metric | Target (P50) | Upper Bound (P95) |
| :--- | :--- | :--- |
| **Wake Word Detection** | < 100ms | < 150ms |
| **STT First Token Result** | < 200ms | < 350ms |
| **Time-to-First-Action (TTFA)** | < 500ms | < 800ms |
| **LLM Time-to-First-Token (TTFT)** | < 300ms (Groq) | < 600ms |
| **TTS First Audio Chunk** | < 150ms | < 300ms |
| **Total Voice-to-Action Feedback** | < 600ms | < 1000ms |

### NFR-2: Resource & Battery Constraints
- Idle background battery drain: < 1.5% per hour when listening for wake word.
- Peak memory consumption of React Native app + Native Modules: < 250MB RAM.
- CPU utilization in idle standby: < 2%.

### NFR-3: Reliability & Fallbacks
- Offline operation: Native actions (alarms, volume, app launches, flashlight) must function with zero internet connectivity.
- Bounded recovery: Agent execution timeout capped at 30 seconds per task.

---

## 3. Acceptance Benchmark Tasks

```text
┌────┬──────────────────────────────────────┬────────────────────────────────────────────────────────┐
│ ID │ Task Description                     │ Verification Criteria                                  │
├────┼──────────────────────────────────────┼────────────────────────────────────────────────────────┤
│ B1 │ "Open YouTube and search Taarak       │ 1. YouTube opens <500ms.                               │
│    │  Mehta, play most viewed episode"   │ 2. Search query typed & entered.                       │
│    │                                      │ 3. Top result tapped. Playback verified.               │
├────┼──────────────────────────────────────┼────────────────────────────────────────────────────────┤
│ B2 │ "Send WhatsApp message to Mom:       │ 1. WhatsApp opens.                                     │
│    │  'I am on my way'"                  │ 2. Mom chat found & opened.                            │
│    │                                      │ 3. Text typed. Send button tapped.                     │
│    │                                      │ 4. Verified message bubble in chat history.            │
├────┼──────────────────────────────────────┼────────────────────────────────────────────────────────┤
│ B3 │ "Set brightness to 50% & alarm at 7" │ 1. System brightness updated via Settings API.         │
│    │                                      │ 2. Alarm created in default Clock app.                 │
│    │                                      │ 3. Spoken confirmation in <800ms total.                │
└────┴──────────────────────────────────────┴────────────────────────────────────────────────────────┘
```