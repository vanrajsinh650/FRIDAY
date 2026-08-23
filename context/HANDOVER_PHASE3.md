# FRIDAY — Session Handover (Phase 3: Reasoned Selection + Verification)

> **Date:** 2026-08-22  
> **Scope of this handover:** the architecture upgrade work — Phases 1–2 (tiered model + on-demand vision + secrets) and **Phase 3 (reasoned result selection, evidence-based verification, full WhatsApp send flow)**.  
> **Status:** All TypeScript work complete and verified. `tsc --noEmit` exits 0; **36/36 Jest tests green across 7 suites.** Phase 4 (native Shizuku) is not started — it is gated on a physical-device checkpoint.

---

## 1. TL;DR — what changed and why

FRIDAY can now (a) **reason over a list of results** instead of blindly tapping the first card, (b) **never claim success it cannot prove** (playback and message-send are gated on real evidence), and (c) **complete a full WhatsApp send end-to-end** (search → open chat → type → send → verify), all testable offline.

Two headline defects are fixed:
- **BUG-001** (prior): app relaunch loop / blind execution — preflight Accessibility gate + launch-once guard.
- **BUG-002** (this work): agent announced success without confirming the outcome — replaced with bounded verify loops + evidence-based terminal conditions.

---

## 2. Current architecture (as-built)

**Agent loop:** `FridayAgent.executeGoal` → `AgentLoop.run` → `Planner.planNextAction` → tiered `ProviderRouter`. `ExecutionEngine`/`StepExecutor` run tools; `ContextManager` assembles the snapshot; `TaskManager.isTerminalConditionMet` does evidence-based verification after each step; the loop's **honesty gate** at the end reports the truth if unverified.

**Model providers (tiered, NVIDIA-primary):** Tier-0 deterministic `intentFastPath` (offline, no network) → NVIDIA primary reasoner/"eyes" → Groq/OpenAI/Local fallbacks. First confident answer wins; hard failures throw so the router falls through. Non-vision fallbacks get image parts stripped.

**On-demand vision:** `VisionPerception` attaches a screenshot only when the accessibility tree is too sparse to act on *and* the flag is on — never per-frame.

**Perception → selection:** `ResultRanker` (pure module) ranks visible result cards; the planner opens the best match by node id, or falls back to the platform's first card when nothing ranks confidently.

**Verification (honesty invariant):** clicking is never proof. Playback needs audio/transport-control evidence; message-send needs a verify step **and** a delivered/read marker.

---

## 3. Files changed / added

### Phase 1–2 (foundation — prior to this session)
| File | Change |
| :--- | :--- |
| `src/config/secrets.ts` | **New.** Central secret resolution: runtime override → `process.env.FRIDAY_*` → dev fallback. Only place API keys are named. |
| `.env.example` | **New.** Documents `FRIDAY_GROQ_API_KEY` / `FRIDAY_NVIDIA_API_KEY` / `FRIDAY_OPENAI_API_KEY`. |
| `src/state/settingsStore.ts` | Keys resolved via `getSecret(...)`; NVIDIA default provider; added `nvidiaVisionModel`. |
| `src/agent/providers/nvidiaProvider.ts` | Primary reasoner; `supportsVision`; picks vision model only when an image is present; **throws** on hard failure so router falls back. |
| `src/agent/providers/groqProvider.ts` | Key via `getSecret`; Tier-0 fast-path; network `reasonToolCall` **throws** on failure (no fake spoken reply). |
| `src/agent/perception/visionPerception.ts` + provider `types.ts` | Multimodal `ModelMessage.content`, `supportsVision`, `hasImageContent`, on-demand screenshot augmentation. |

### Phase 3 (this session)
| File | Change |
| :--- | :--- |
| `src/agent/perception/resultRanker.ts` | **New (earlier in Phase 3).** Pure ranker: token overlap + view-count/position bonuses − ad/sponsored penalty; excludes chrome/undersized nodes; returns `null` when nothing genuinely matches. |
| `src/agent/planner.ts` | `buildResultClick` (ranked `click_first_result` by nodeId); playback verify loop; **`extractMessageIntent`** (who/what parser, EN + romanised Hindi); **rewritten `MESSAGING` branch** (search → open → type → send → bounded verify). |
| `src/native/AccessibilityModule.ts` | `clickFirstResultCard(nodeId?)`; **WhatsApp mock state machine**: `setMockPackage` chat-list state, package-aware `typeText`, `clickText` chat-open transition + `openMockWhatsAppChat`, delivered-bubble posting in `clickSendOrActionButton`; `clickText` now prefers a non-editable actionable row over the search field. |
| `src/tools/phoneControlTools.ts` | `click_first_result` accepts optional `nodeId`; `verify_playback_active`, `verify_message_sent`, `wait_for_element` tools. |
| `src/agent/task/taskManager.ts` | **Evidence-based** `PLAYBACK_ACTIVE` and `MESSAGE_SENT` terminal conditions. |
| `__tests__/resultRanker.test.ts` | **New.** 7 tests (ranking correctness + planner integration). |
| `__tests__/messaging.test.ts` | **New.** 11 tests (6 parser, 4 planner-branch, 1 full offline e2e). |
| `context/PROJECT_STATE.md`, `context/BUG_TRACKER.md` | Phase 3 status, new audit rows, BUG-002 entry. |

---

## 4. How to verify

```bash
npx tsc --noEmit
```
```bash
npx jest
```

Expected: `tsc` exit 0; **36 passed, 7 suites**. The line mentioning `voice.test.ts:73` is a `console` log inside a passing test, not a failure.

**Key benchmarks:**
- YouTube e2e (`agent.test.ts`): launch → click_node → type_text → … → SUCCESS.
- WhatsApp e2e (`messaging.test.ts`): `launch_app → type_text → click_text → click_send_button → verify_message_sent`, verified SUCCESS.

---

## 5. Design decisions a maintainer must know

1. **Tool name `click_first_result` was deliberately kept** even though selection is now ranked (nodeId passed as a param). Downstream branch logic and the mock's player transition key on that name — renaming it would break the flow.
2. **Providers must `throw` on hard failure**, not return a spoken sentinel. The router treats `{toolName:'none', reply}` as a *confident* answer and stops; swallowing an error there would strand the user on a dead primary.
3. **The planner never returns `none` after a click** in the MEDIA/MESSAGING verify phase. It runs a bounded verify loop; if evidence never appears, the loop's honesty gate speaks "couldn't confirm." This is the mechanism that keeps the agent truthful.
4. **Offline testability** rests on: Tier-0 fast-path (no network), the mock accessibility tree state machines (YouTube + WhatsApp), and `NODE_ENV==='test'` short-circuiting sleeps/waits. Keep these intact when adding flows.
5. **The WhatsApp mock starts with the search field focused** — a simplification vs. real WhatsApp (which needs a tap on the search entry first). It is clearly commented; the real device path uses the native module, not the mock.

---

## 6. Pending / next steps

- **Phase 4 — Shizuku-first RootControl** (native Kotlin + TS bridge). Not started; **cannot be built or verified in this environment** — gated on a physical-device checkpoint. Decision recorded as ADR-014 (Shizuku when authorised → true root only if already present → accessibility-only fallback; FRIDAY never roots the device itself).
- **Security follow-up:** rotate the dev-fallback API keys in `src/config/secrets.ts` before any committed/public release; regenerate `android/app/src/main/assets/index.android.bundle` so it no longer embeds the old keys (the compiled bundle still carries them until the next build).
- **Optional flow hardening:** message-body case is preserved, but the English `send X to Y` parser resolves ambiguous mid-message "to" naively — quoting disambiguates. Consider a contacts-lookup step for fuzzy contact names on-device.

---

## 7. Known limitations

- Live send/playback verification markers depend on the app's TalkBack descriptions; the bounded `wait_for_element` loop gives them a couple of cycles, then reports honestly.
- All e2e coverage is against the offline mock trees — real-device behavior for YouTube/WhatsApp still needs the physical benchmark in `PROJECT_STATE.md §2`.
