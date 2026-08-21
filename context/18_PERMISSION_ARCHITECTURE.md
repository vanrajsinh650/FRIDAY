# FRIDAY — Permission Architecture & Onboarding

---

## 1. Permission Matrix & Access Classification

| Permission | Android Mechanism | Purpose in FRIDAY |
| :--- | :--- | :--- |
| **Accessibility** | Special Access (`Settings.ACTION_ACCESSIBILITY_SETTINGS`) | Screen reading, node traversal, gesture clicks |
| **Voice Assistant** | Special Role (`ACTION_VOICE_INPUT_SETTINGS`) | System default assistant, lock screen overlay |
| **Microphone** | Runtime (`RECORD_AUDIO`) | Wake word detection & STT voice input |
| **Battery Optimization** | Special Intent (`ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`) | Prevents OS from killing background service |
| **Notifications** | Special Access (`ACTION_NOTIFICATION_LISTENER_SETTINGS`) | Read incoming messages, dismiss alerts |
| **System Settings** | Special Permission (`WRITE_SETTINGS`) | Change screen brightness, volume, timeouts |
| **Screen Capture** | User Consent (`MediaProjectionManager`) | Vision fallback screenshot analysis |
| **Contacts / Phone** | Runtime (`READ_CONTACTS`, `CALL_PHONE`) | Contact lookup and initiating phone calls |

---

## 2. Interactive Onboarding & Graceful Degradation

- **Onboarding Checklist:** React Native onboarding wizard guides the user step-by-step through granting required Special Access permissions with direct deep-links to Android settings pages.
- **Graceful Degradation:** If a permission is missing (e.g. Notification Access), FRIDAY operates normally for other tasks and politely explains what permission is needed only when a relevant action is requested.