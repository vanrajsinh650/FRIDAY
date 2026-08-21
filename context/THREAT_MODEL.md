# FRIDAY — Threat Model & Attack Surface Analysis

---

## 1. System Assets & Sensitive Resources
- **On-Device Data:** Contacts, SMS/WhatsApp messages, Photos, File storage, Location, Notifications.
- **Device Capabilities:** Making phone calls, modifying system settings, launching arbitrary apps, dispatching touch gestures.
- **Credentials & Secrets:** Cloud LLM API keys (Groq, NVIDIA), backend auth tokens.

---

## 2. Threat Analysis (STRIDE)

| Category | Threat Scenario | Mitigation Strategy |
| :--- | :--- | :--- |
| **Spoofing** | Unauthorized user speaking wake word to trigger actions | Voice biometric verification / Lock-screen action gating. |
| **Tampering** | Malicious app attempting to intercept Accessibility gestures | AccessibilityService isolation & Android OS sandbox security. |
| **Repudiation** | Actions performed without audit trail | Immutable structured event logging stored in local SQLite. |
| **Information Disclosure** | LLM logs containing user PII / message content | Automatic client-side PII scrubbing before sending to remote model. |
| **Denial of Service** | Agent trapped in recursive infinite UI loop | Bounded step counter (max 10 actions per task) + 30s hard timeout. |
| **Elevation of Privilege** | Prompt injection via incoming notification or webpage | Untrusted text quarantined; high-impact actions require explicit modal confirmation. |