# FRIDAY — Security Runbook & Incident Response

---

## 1. Emergency Kill-Switch Activation
If the agent behaves erratically or enters an unintended UI loop:
1. **Trigger:** Triple-press device power button or tap the red emergency button on the floating HUD overlay.
2. **Immediate Action:**
   - React Native `agentStore` triggers `reset()`.
   - `FridayAccessibilityService` cancels all active `dispatchGesture()` tasks.
   - Active TTS playback and microphone recording are immediately stopped.
   - Foreground notification displays: *"FRIDAY emergency stopped."*

---

## 2. API Key Revocation & Credential Rotation Protocol
If a model API key or backend auth token is compromised:
1. Revoke the existing key in the provider console (Groq / NVIDIA / OpenAI).
2. Generate a new key and update `.env` on the VPS backend.
3. Restart the backend container: `docker compose restart`.
4. In the React Native app: Open `SettingsScreen` -> update auth token -> tap *Verify Connection*.

---

## 3. Data Wipe & Factory Reset Procedure
To wipe all local memory and configurations:
1. Open FRIDAY -> `Settings` -> `Privacy & Memory`.
2. Tap *Wipe All Local Memory & Cached Plans*.
3. Execute `MMKV.clearAll()` and `DROP TABLE memory_records;` in SQLite.