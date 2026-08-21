# FRIDAY — Repository Structure & File Conventions

---

## 1. Complete Monorepo Directory Tree

```text
FRIDAY/
├── README.md
├── package.json
├── tsconfig.json
├── .env.example
├── context/                             # Architecture Single Source of Truth
│   ├── 00_README.md
│   ├── 01_PRODUCT_VISION.md
│   └── ... (All 31 Context & State Files)
├── src/                                 # React Native Application Source
│   ├── app/                             # App entry point, Providers, Root Navigator
│   ├── components/                      # Reusable UI widgets (HUD, Orb, Buttons)
│   ├── screens/                         # AssistantScreen, SettingsScreen, DebugScreen
│   ├── navigation/                      # Navigation containers and route definitions
│   ├── agent/                           # FRIDAY Agent Core
│   │   ├── agent.ts                     # Core State Machine
│   │   ├── planner.ts                   # Task decomposition & planning
│   │   ├── executor.ts                  # Tool dispatch & execution
│   │   ├── verifier.ts                  # Post-action state assertion
│   │   ├── context.ts                   # Dynamic context manager
│   │   ├── promptBuilder.ts             # System prompt generator
│   │   └── types.ts                     # Agent schemas & interfaces
│   ├── tools/                           # Tool definitions & registry
│   │   ├── registry.ts                  # Dynamic tool registry
│   │   ├── systemTools.ts               # Volume, brightness, settings
│   │   ├── uiTools.ts                   # Tap, swipe, type, inspect
│   │   └── appTools.ts                  # Launch app, open URL
│   ├── voice/                           # Voice Pipeline
│   │   ├── wakeWord.ts                  # Wake word listener bridge
│   │   ├── stt.ts                       # Speech recognition service
│   │   ├── tts.ts                       # Pocket-TTS / local speech synthesis
│   │   └── audioManager.ts              # Audio routing, ducking & focus
│   ├── memory/                          # Structured Memory Engine
│   │   ├── profile.ts                   # User profile & facts
│   │   ├── store.ts                     # SQLite / MMKV local persistence
│   │   └── retriever.ts                 # Scoped context retrieval
│   ├── native/                          # TypeScript interfaces for Native Modules
│   │   ├── AccessibilityModule.ts       # UI tree inspection & gesture dispatch
│   │   ├── VoiceInteractionModule.ts    # Assistant session & overlay
│   │   ├── NotificationModule.ts        # Notification listener
│   │   ├── SystemControlModule.ts       # Hardware & OS intents
│   │   └── ScreenCaptureModule.ts       # MediaProjection screenshots
│   ├── permissions/                     # Centralized Permission Subsystem
│   ├── state/                           # Zustand stores (agentStore, voiceStore)
│   └── utils/                           # Logger, formatters, coordinates
├── android/                             # Native Android Project
│   ├── app/
│   │   └── src/main/
│   │       ├── AndroidManifest.xml
│   │       ├── java/com/friday/
│   │       │   ├── MainActivity.kt
│   │       │   ├── MainApplication.kt
│   │       │   ├── accessibility/
│   │       │   │   ├── FridayAccessibilityService.kt
│   │       │   │   ├── AccessibilityNodeParser.kt
│   │       │   │   └── GestureDispatcher.kt
│   │       │   ├── voice/
│   │       │   │   ├── FridayVoiceInteractionService.kt
│   │       │   │   └── FridayVoiceInteractionSession.kt
│   │       │   ├── modules/
│   │       │   │   ├── AccessibilityTurboModule.kt
│   │       │   │   ├── VoiceTurboModule.kt
│   │       │   │   ├── SystemControlTurboModule.kt
│   │       │   │   └── ScreenCaptureTurboModule.kt
│   │       │   └── services/
│   │       │       └── FridayForegroundService.kt
│   │       └── res/
│   │           └── xml/
│   │               ├── accessibility_service_config.xml
│   │               └── voice_interaction_service_config.xml
├── backend/                             # Optional Remote VPS Brain Server
│   ├── Dockerfile
│   ├── docker-compose.yml
│   ├── requirements.txt
│   └── server/
│       ├── main.py                      # FastAPI gateway & WebSocket hub
│       ├── providers/                   # Groq, NVIDIA NIM, OpenAI adapters
│       └── memory/                      # Remote sync & backup
├── scripts/                             # Development & Automation Scripts
│   ├── setup_android.sh
│   ├── run_adb_benchmarks.py
│   └── test_accessibility.ps1
└── docs/                                # Architecture schematics & media
```