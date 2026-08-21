# FRIDAY Project Working Rules & Mandatory Guidelines

> **Status:** Mandatory & Always Active  
> **Applies to:** Antigravity AI Agent, Human Developers, Subagents  

---

## 1. Mandatory Pre-Task Context Reading
- **Read First, Code Second:** Before starting work on any task or subsystem, always read the relevant `/context` files (Single Source of Truth).
- **Verify Vision Alignment:** Every implementation decision must align with the product vision: React Native (TypeScript) as primary application layer, Android Native Modules for OS capabilities, fastest-path hybrid control hierarchy, and verification before confirmation.

---

## 2. Git & Commit Guidelines
- **Commit Frequently:** Commit code immediately as soon as a small, discrete coding task is finished.
- **Simple, Clear Commit Messages:**
  - Keep commit messages concise, plain, and human-understandable.
  - **NEVER** use conventional commit prefixes (do NOT use `feat:`, `docs:`, `fix:`, `chore:`, `refactor:`, `test:`, etc.).
  - Simply describe the change clearly (e.g. `add accessibility service module`, `setup react native project structure`, `integrate groq model provider`).
- **No Large Uncommitted Batches:** Keep diffs atomic and verified.

---

## 3. Code Quality & Cleanliness Standards
- **Clean & Readable Code:** Write modular, understandable, and well-structured code.
- **Strict Typing:** Use comprehensive TypeScript interfaces and avoid loose `any` types.
- **No Clutter or Spaghetti:** Avoid dead code, unneeded files, duplicate logic, and redundant abstraction layers.
- **Preserve Existing Documentation:** Never break or delete existing context files or project invariants.

---

## 4. Operational Invariants
- **React Native First:** Do NOT rewrite the frontend in Kotlin. Native Android code is strictly for bridge capabilities (`AccessibilityService`, `VoiceInteractionService`, `MediaProjection`, `AlarmManager`).
- **Speed is a Feature:** Prefer deterministic local actions over slow LLM calls whenever possible.
- **Verification First:** Never report task completion to the user without visual or state verification.
- **Maintain Living State:** Update `PROJECT_STATE.md` and `BUG_TRACKER.md` as work progresses.
