# FRIDAY — Phone Control Architecture & Hybrid Execution

---

## 1. The Hybrid Priority Hierarchy

To achieve industry-leading responsiveness, FRIDAY never uses slow, heavy AI mechanisms when fast, deterministic local Android actions can achieve the same goal.

```text
Priority 1: Native Android Local Logic / System APIs (0-50ms)
    └─ Volume, Brightness, Flashlight, Battery, Clock Alarms
         │
         ▼ (If app action required)
Priority 2: Android Intents / Package Manager (50-200ms)
    └─ Launch YouTube, Open WhatsApp chat deep link, Open Maps coords
         │
         ▼ (If in-app UI navigation required)
Priority 3: Accessibility Node Tree Hierarchy (100-300ms)
    └─ Find Search bar, Type query, Click matching video title, Press Send
         │
         ▼ (If UI nodes invisible / unparsed)
Priority 4: Vision-Based Fallback (600-1200ms)
    └─ MediaProjection screenshot + Visual Grounding Model for coordinate tap
```

---

## 2. Speculative Execution & Pipelining

When a user says *"Open YouTube and search Taarak Mehta Ka Ooltah Chashmah"*:
1. **At T = 100ms (Voice partially parsed):** Intent classified as YouTube task -> Intent launched immediately via `launchApp("com.google.android.youtube")`.
2. **At T = 350ms (App foregrounding):** Agent receives screen tree, locates the search icon node ID.
3. **At T = 450ms (Search icon tapped):** Text injection tool prepares query string.
4. **At T = 600ms:** Query submitted, results loading.

Zero idle wait time while generating complex downstream reasoning.