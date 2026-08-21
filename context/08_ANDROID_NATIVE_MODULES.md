# FRIDAY — Android Native Modules Layer

---

## 1. Native Bridge Architecture

All device-specific Android capabilities are exposed to React Native via clean TypeScript wrappers backed by Kotlin TurboModules / JSI bindings.

```text
React Native (TypeScript)
      │
      ├── AccessibilityModule.ts
      ├── VoiceInteractionModule.ts
      ├── SystemControlModule.ts
      ├── NotificationModule.ts
      ├── ScreenCaptureModule.ts
      └── SchedulerModule.ts
      │
      ▼ JSI / TurboModule Bridge
Android Native (Kotlin)
      │
      ├── AccessibilityTurboModule.kt   ──> FridayAccessibilityService.kt
      ├── VoiceTurboModule.kt           ──> FridayVoiceInteractionService.kt
      ├── SystemControlTurboModule.kt   ──> AudioManager, Settings.System, Intents
      ├── NotificationTurboModule.kt    ──> FridayNotificationListener.kt
      ├── ScreenCaptureTurboModule.kt   ──> MediaProjection API
      └── SchedulerTurboModule.kt       ──> AlarmManager + WorkManager
```

---

## 2. Core Native Module Specifications

### A. AccessibilityModule (`src/native/AccessibilityModule.ts`)
```typescript
export interface UINode {
  id: string;
  className: string;
  text?: string;
  contentDescription?: string;
  bounds: { left: number; top: number; right: number; bottom: number; centerX: number; centerY: number };
  isClickable: boolean;
  isEditable: boolean;
  isScrollable: boolean;
  packageName: string;
}

export interface IAccessibilityModule {
  isServiceEnabled(): Promise<boolean>;
  openAccessibilitySettings(): void;
  inspectScreen(): Promise<{ packageName: string; nodes: UINode[]; timestamp: number }>;
  clickNode(nodeId: string): Promise<boolean>;
  clickCoordinates(x: number, y: number): Promise<boolean>;
  typeText(text: string, clearFirst?: boolean): Promise<boolean>;
  scroll(direction: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT'): Promise<boolean>;
  swipe(startX: number, startY: number, endX: number, endY: number, durationMs: number): Promise<boolean>;
  pressBack(): Promise<boolean>;
  pressHome(): Promise<boolean>;
}
```

### B. VoiceInteractionModule (`src/native/VoiceInteractionModule.ts`)
```typescript
export interface IVoiceInteractionModule {
  isDefaultAssistant(): Promise<boolean>;
  requestAssistantRole(): void;
  startListening(): Promise<boolean>;
  stopListening(): Promise<boolean>;
  speakAudioChunk(base64Audio: string): Promise<void>;
  stopSpeaking(): Promise<void>;
}
```

### C. SystemControlModule (`src/native/SystemControlModule.ts`)
```typescript
export interface ISystemControlModule {
  launchApp(packageName: string): Promise<boolean>;
  openUrl(url: string): Promise<boolean>;
  getBatteryStatus(): Promise<{ level: number; isCharging: boolean }>;
  setVolume(stream: 'MEDIA' | 'ALARM' | 'RING', level: number): Promise<boolean>;
  setBrightness(percentage: number): Promise<boolean>;
  setFlashlight(enabled: boolean): Promise<boolean>;
  getInstalledApps(): Promise<Array<{ appName: string; packageName: string }>>;
}
```