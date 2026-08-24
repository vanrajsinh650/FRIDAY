# FRIDAY — Memory Architecture & Personalization (ADR-007, ADR-017)

---

## 1. Structured Personal Memory & Profile Graph

Instead of an expensive on-device vector database, FRIDAY utilizes **structured relational memory** stored in local storage on the phone (`MemoryStore`), synchronized to the VPS backend.

### Memory Schema Categories:
1. **UserProfile:** Locked identity (`name: 'Boss'`), aliases, primary language, favorite apps (music, maps, chat), system preferences, and contact profiles.
2. **Relationships & Profile Graph:** Subject-predicate-object triples (`user -> wife -> Pepper Potts`, `Pepper Potts -> phone -> +1-555-0199`, `user -> boss -> Tony Stark`).
3. **Dynamic TTL & Importance Scoring:**
   - **Long-Term Permanent Memory:** Permanent facts (`isPermanent: true`, importance 0.8–1.0) retained indefinitely.
   - **Short-Term Session Memory:** Dynamic TTL expiration (`ttlMs` / `ttlSeconds`, importance 0.2–0.5) auto-purged on session completion or timeout.
4. **App & System Preferences:** Preferred media apps (YouTube vs Spotify), default map provider (Google Maps vs Waze), volume defaults, auto-dismiss HUD timers.
5. **Contacts Profile Graph:** Structured contact profiles with relationship mapping, aliases, and phone numbers.

---

## 2. Scoped Context Retrieval & Graph Expansion

The agent does NOT dump the entire memory store into every prompt. Before calling the LLM or reasoner, `ScopedMemoryRetriever`:
1. **Multi-Signal Scored Matching:** Exact phrase matching in key/value (+15/+10), token overlap (+5), category weighting, and active package weighting (+8).
2. **Graph Relation Expansion:** Explores entity connections (e.g. goal "Call my wife" resolves `user -wife-> Pepper Potts` and pulls both relationship and contact phone facts).
3. **Query-Scoped Context Formatting:** Generates concise, token-efficient system prompt sections via `ScopedMemoryRetriever.formatContext(goal, activePackage)`.
4. **Expired TTL Filtering:** Excludes expired facts from reasoning context.

---

## 3. Persona Manager & Voice Locking (ADR-015, ADR-017)

`PersonaManager` strictly enforces the authentic MCU F.R.I.D.A.Y. character:
1. **Voice Configuration:** Microsoft Edge Neural Irish voice (`en-IE-EmilyNeural`).
2. **Boss Exclusive Address:** Replaces non-Boss names/titles (Tony, Sir, Master, user, human) with "Boss".
3. **TTS Audio Optimization:**
   - Strips all markdown symbols (`**`, `#`, `-`, `*`, `` ` ``, `[]()`).
   - Strips raw JSON parameter leaks or code blocks.
   - Constrains responses to 1–4 crisp sentences.
4. **Validation & Precompiled Fast-Paths:** Deterministic greetings for instant (<10ms) zero-token responses.

---

## 4. User Authority & Privacy
- Full CRUD tools (`save_memory_fact`, `store_memory_fact`, `get_memory_facts`, `forget_memory_fact`, `set_relationship`, `get_relationship_graph`, `manage_profile`).
- UI Management in React Native (`MemoryManagerScreen`).
- Instant deletion of any fact or complete memory wipe at user command.