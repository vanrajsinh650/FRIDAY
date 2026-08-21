# FRIDAY — Bug & Defect Tracker

---

## Defect Severity Scale
- **P0 (Critical):** App crash, agent infinite loop, unauthorized destructive action.
- **P1 (High):** Gesture dispatch failure, STT stall, wake-word false rejection.
- **P2 (Medium):** UI tree misparsing, minor TTS glitch, slow animation frame drop.
- **P3 (Low):** Minor styling or layout inconsistency.

---

## Active Defect Log

| ID | Title | Severity | Status | Component | Root Cause | Fix Summary |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| *None* | No active bugs logged in Phase 0 | - | - | - | - | - |

---

## Defect Template (For Logging New Issues)

```markdown
### [BUG-XXX] Short Title

- **Severity:** P0 / P1 / P2 / P3
- **Status:** Open / In Progress / Verified
- **Component:** `src/agent/`, `android/accessibility/`, `src/voice/`
- **Reproduction Steps:**
  1. Say "Hey Friday, open YouTube"
  2. ...
- **Expected Behavior:** ...
- **Actual Behavior:** ...
- **Root Cause Analysis:** ...
- **Fix & Regression Test:** ...
```