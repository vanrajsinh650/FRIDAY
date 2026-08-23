# FRIDAY Project Working Rules & Mandatory Guidelines

> **Status:** Mandatory & Always Active  
> **Applies to:** Antigravity AI Agent, Human Developers, Subagents  

---

## 1. Mandatory Pre-Task Context Reading & Maintenance
- **Read First, Code Second:** Before starting work on any task or subsystem, always read the relevant `/context` files (Single Source of Truth).
- **Verify Vision Alignment:** Every implementation decision must align with the product vision: React Native (TypeScript) as primary application layer, Android Native Modules for OS capabilities, fastest-path hybrid control hierarchy, and verification before confirmation.
- **Maintain Living State Invariant:** Context files in `context/` (`PROJECT_STATE.md`, `BUG_TRACKER.md`, `25_DECISION_LOG.md`, `10_VOICE_ARCHITECTURE.md`, `RULES.md`) are critical project invariants. Whenever architecture changes or bugs are resolved, they must be updated immediately and never neglected.

---

## 2. Git & Commit Guidelines
- **Commit Frequently:** Commit code immediately as soon as a small, discrete coding task is finished.
- **Simple, Clear Commit Messages:**
  - Keep commit messages concise, plain, and human-understandable.
  - **NEVER** use conventional commit prefixes (do NOT use `feat:`, `docs:`, `fix:`, `chore:`, `refactor:`, `test:`, etc.).
  - Simply describe the change clearly (e.g. `add edge neural tts engine`, `implement continuous keyword command pipeline`, `lock persona to boss identity`).
- **No Large Uncommitted Batches:** Keep diffs atomic and verified.

---

## 3. Code Quality & Cleanliness Standards
- **Clean & Readable Code:** Write modular, understandable, and well-structured code.
- **Strict Typing:** Use comprehensive TypeScript interfaces and avoid loose `any` types.
- **No Clutter or Spaghetti:** Avoid dead code, unneeded files, duplicate logic, and redundant abstraction layers.
- **Preserve Existing Documentation:** Never break or delete existing context files or project invariants.

---

## 4. Operational Invariants
- **React Native First:** Do NOT rewrite the frontend in Kotlin. Native Android code is strictly for bridge capabilities (`AccessibilityService`, `VoiceInteractionService`, `MediaProjection`, `AlarmManager`, `TTSTurboModule`, `FridayForegroundService`).
- **Speed is a Feature:** Prefer deterministic local actions and Tier-0 fast-paths over slow LLM calls whenever possible.
- **Verification First:** Never report task completion to the user without visual or state verification (e.g. active audio transport controls or confirmed message delivery marker).
- **Identity & Persona Invariant:**
  - FRIDAY strictly addresses the user as "Boss" in every interaction. Never use generic titles or user names.
  - Maintain the tactical, loyal, witty, and unflappable persona of Marvel's F.R.I.D.A.Y. (Kerry Condon).
  - Spoken responses must be 2–4 sentences, concise, and completely free of markdown symbols (*, #, `, -) or raw JSON leaks.
- **Voice Invariant:**
  - Primary voice is Microsoft Edge Neural TTS with Kerry Condon authentic Irish accent (`en-IE-EmilyNeural`).
  - STT uses 24/7 continuous keyword prefix pipeline with single-breath compound execution ("Friday, <command>").
  - Noise, filler words, and incomplete verbs are rejected by `ActionSafetyGuard` before LLM invocation.
