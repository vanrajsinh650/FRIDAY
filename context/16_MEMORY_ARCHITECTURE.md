# FRIDAY — Memory Architecture & Personalization

---

## 1. Structured Personal Memory

Instead of an expensive on-device vector database, FRIDAY utilizes **structured relational memory** stored in local SQLite / MMKV on the phone, synchronized to the VPS backend.

### Memory Schema Categories:
1. **UserProfile:** Name, preferred nickname, primary language, voice preferences.
2. **Relationships & Contacts:** Key nicknames ("Mom" -> "+919876543210", "Boss" -> "Vikram").
3. **App Preferences:** Preferred media player (YouTube vs. Spotify), default map provider, frequently used apps.
4. **Task History:** Past successful plans and UI paths for quick cached replay.
5. **Scheduled Jobs:** Registered recurring timers, alarms, and morning briefings.

---

## 2. Scoped Context Retrieval

The agent does NOT dump the entire memory into every prompt. Before calling the LLM, the `ContextManager` queries local SQLite for facts relevant only to the active entities and active package name, preserving token budget and latency.

### User Authority & Privacy:
- Full CRUD UI in React Native (`MemoryManagerScreen`).
- Instant deletion of any fact or complete memory wipe at user command.