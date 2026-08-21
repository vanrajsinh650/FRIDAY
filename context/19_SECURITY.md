# FRIDAY — Security Architecture & Threat Boundaries

---

## 1. Security Invariants & Secret Isolation

1. **Zero Hardcoded Secrets:** No API keys, cloud tokens, or personal secrets are stored in the React Native JavaScript bundle or committed to Git.
2. **Hardware-Backed Keystore:** Local secrets (e.g. backend auth token) are encrypted via Android Keystore and `EncryptedSharedPreferences`.
3. **High-Impact Action Gates:** FRIDAY enforces mandatory user confirmation (voice or visual prompt) before executing:
   - Financial payments or money transfers (UPI, banking apps).
   - Deleting files, photos, or contacts.
   - Sending messages to unrecognized phone numbers.
   - Factory reset or changing system lock credentials.
4. **Local Execution of Sensitive Tasks:** Personal data (contacts, active screen text, notifications) is processed locally whenever possible and never sent to third-party logs.