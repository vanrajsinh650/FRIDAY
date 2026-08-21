# FRIDAY — Security Invariants

> **Status:** Mandatory & Non-Negotiable  
> **Scope:** All Agent Planners, Tools, Native Modules, and Backend Services  

---

## The 10 Inviolable Security Rules

1. **No Hardcoded Secrets in Client Code:** API keys, certificates, and auth secrets must NEVER exist in TypeScript files or committed git repositories.
2. **Mandatory User Confirmation for High-Impact Actions:** Financial transactions (UPI, banking), deleting files/contacts, sending messages to new numbers, and factory settings ALWAYS require explicit user voice/button confirmation.
3. **No Root or Illegal Workarounds:** The system must strictly operate within legitimate Android permissions (`AccessibilityService`, `VoiceInteractionService`).
4. **Data Minimization:** Only screen elements relevant to the active goal are processed; full raw screenshots are discarded immediately after coordinate extraction.
5. **No Blind Verification:** The agent must never report success without observing post-action visual proof.
6. **Bounded Execution Timeout:** Any agent task exceeding 30 seconds or 10 steps must abort gracefully and inform the user.
7. **Encrypted Storage:** All local tokens and user memory records must be stored using Android Keystore / EncryptedSharedPreferences.
8. **Network Encryption:** All communications with the VPS brain or model providers must use TLS 1.3 with certificate validation.
9. **Instant Emergency Kill-Switch:** A dedicated hardware gesture (triple power button press or double volume down) immediately terminates all active agent loops and revokes foreground overlay.
10. **Full User Memory Sovereignty:** The user retains complete authority to view, edit, export, or permanently wipe all stored personal memory.