# FRIDAY — Bug & Defect Tracker

---

## Defect Severity Scale
- **P0 (Critical):** App crash, agent infinite loop, unauthorized destructive action.
- **P1 (High):** Gesture dispatch failure, STT stall, wake-word false rejection, TTS network failure.
- **P2 (Medium):** UI tree misparsing, minor TTS glitch, slow animation frame drop.
- **P3 (Low):** Minor styling or layout inconsistency.

---

## Active Defect Log

| ID | Title | Severity | Status | Component | Root Cause | Fix Summary |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| BUG-001 | YouTube reopened repeatedly; never searches or plays | P0 | Verified | `src/agent/` | No accessibility preflight + unconditional relaunch when app not seen as foreground | Preflight gate prompts to enable Accessibility; planner launches once → waits → stops |
| BUG-002 | Agent claims success without confirming playback/send | P1 | Verified | `src/agent/` | Planner returned `none` right after a click and terminal accepted the click itself as proof | Evidence-based terminal conditions + bounded verify loops (`verify_playback_active` / `verify_message_sent`); honesty gate reports "couldn't confirm" when unproven |
| BUG-003 | Silent on "wake up" / "hey friday" / "friday" greetings | P1 | Verified | `src/agent/`, `src/voice/`, `android/` | VAD handoff dropped speech frames + missing greeting intents in Tier-0 fast-path | Added wake/greeting fast-paths + direct continuous speech recognition with partial matching + TTS fallback |
| BUG-005 | Groq TTS 400 Bad Request (model terms required / playai decommissioned) | P1 | Verified | `android/modules/TTSTurboModule.kt`, `src/voice/tts.ts` | Groq TTS endpoint required custom PlayAI terms/keys and returned HTTP 400 Bad Request on standard requests | Migrated to Microsoft Edge Neural TTS (`en-IE-EmilyNeural` Kerry Condon Irish voice) via WebSocket streaming + local MP3 disk cache + MediaPlayer |
| BUG-006 | Double-verification wake deadlock and acoustic false triggers | P1 | Verified | `android/services/FridayForegroundService.kt`, `src/voice/` | Two-stage VAD handoff killed audio record and missed follow-up speech, while ambient room noise triggered false execution | Implemented 24/7 continuous STT keyword prefix pipeline with single-breath command execution ("Friday, <command>") and `ActionSafetyGuard` noise/verb filtering |
| BUG-007 | SpeechRecognizer binder death & continuous mic start/stop beeps | P1 | Verified | `android/services/FridayForegroundService.kt`, `android/modules/TTSTurboModule.kt` | Android SpeechRecognizer IPC disconnects in background and plays system audio chimes every loop | Replaced with 100% silent AudioRecord HAL stream + Groq Whisper in-memory RAM transcription + 10s multi-turn conversational window + purged Google TextToSpeech |
| BUG-008 | Flat waveform bars & zero response during active queries | P1 | Verified | `android/services/FridayForegroundService.kt`, `src/voice/stt.ts`, `src/components/VoiceWaveform.tsx` | Empty stub in startActiveQuery prevented AudioRecord from recording, emitting RMS volume, or transcribing user speech | Implemented active query AudioRecord streaming, 75ms onSpeechVolumeChanged RMS emission, in-memory Groq Whisper STT, and dynamic cyan cybernetic waveform equalizer |
| BUG-009 | Vivo Funtouch OS UNPROCESSED AudioSource -1 AudioFlinger Track Rejection | P1 | Verified | `android/voice/FarFieldAudioPreprocessor.kt`, `android/services/FridayForegroundService.kt` | MediaRecorder.AudioSource.UNPROCESSED (source 9) is restricted by Vivo Funtouch OS at the HAL level, causing AudioFlinger to return error -1 | Prioritized VOICE_RECOGNITION (source 6) with MIC/DEFAULT fallbacks, strict AudioRecord release on failed attempts, delayed wake startup in service, and Whisper English bias |
| BUG-010 | Unexpected hardware volume jumping & inaudible TTS voice responses | P1 | Verified | `src/voice/audioManager.ts`, `android/modules/TTSTurboModule.kt` | duckMediaAudio mutated master device volume (15%/70%) on every turn; USAGE_ASSISTANT muted on Vivo; Edge TTS 403 had no fallback | Purged master volume mutations from AudioManager, switched to USAGE_MEDIA + STREAM_MUSIC with unity gain (1.0f, 1.0f), added native AudioFocus management, and added local offline TTS fallback |
| BUG-011 | Spontaneous false wake acks ("Standing by, Boss.", "Yes, Boss?") on ambient noise | P1 | Verified | `android/services/FridayForegroundService.kt`, `android/voice/WakeWordDetector.kt`, `src/voice/voicePipeline.ts` | handleWakeDetected treated empty trailing command as standalone Friday wake without verifying transcript contained "Friday"; 256ms premature acoustic triggers | Implemented mandatory containsWakeWord transcript verification gate with silent discard, improved WakeWordDetector speech segment collection, and added JS wake regex gate |
| BUG-012 | False-success on unreadable screens & missing search verification | P0 | Verified | `src/agent/loop/agentLoop.ts`, `src/agent/task/taskManager.ts` | Planner returned `{ toolName: 'none' }` on unreadable screen which agentLoop treated as verified success; missing TEXT_PRESENT verification | Added terminal condition verification on planner none fallback and implemented TEXT_PRESENT & SINGLE_ACTION_DONE success proof |
| BUG-013 | State machine deadlock on user interruption | P0 | Verified | `src/voice/voiceStateMachine.ts`, `src/voice/voicePipeline.ts` | `INTERRUPTED` transition was rejected from active states (`SPEAKING`, `THINKING`, `LISTENING`) | Allowed `INTERRUPTED` from all active states in VALID_TRANSITIONS and cleaned up audio/agent store synchronously |
| BUG-014 | Piecewise math discontinuity in audio pre-amp soft-limiter | P1 | Verified | `android/voice/FarFieldAudioPreprocessor.kt` | Instant drop of 5,279 amplitude units (~16% of full scale) when audio crossed 28,000 threshold | Implemented smooth C1 continuous soft-knee tanh compression curve (T=24000, M=32767) |
| BUG-015 | Native Accessibility Binder handle leak & double-recycle crash | P0 | Verified | `android/accessibility/FridayAccessibilityService.kt` | Early returns without recycling AccessibilityNodeInfo; double recycle when focused === root | Wrapped in try/finally recycling blocks with object identity checks before recycling |
| BUG-016 | 900 anim/sec rAF animation storm on JS thread | P1 | Verified | `src/components/VoiceWaveform.tsx` | Spawning 15 Animated.timing instances inside 60fps requestAnimationFrame loop | Used direct Animated.Value.setValue() in rAF loop without allocating timing objects |
| BUG-021 | Privileged IPC stream deadlocks, shell command injection & Shizuku lifecycle risks | P0 | Verified | `android/modules/RootControlTurboModule.kt`, `src/native/RootControlModule.ts`, `src/tools/rootControlTools.ts`, `AndroidManifest.xml` | Sequential stream reading blocked on OS pipe buffer; unvalidated package/permission shell interpolation; missing Shizuku permission; un-sanitized newlines | Implemented concurrent stream draining, finally process cleanup, strict regex validation for packages & permissions, control char sanitization, AndroidManifest API_V23 permission, and fallback error propagation |
| BUG-022 | Autonomous loop regression & deprecated NVIDIA model 410 Gone error | P0 | Verified | `src/agent/loop/agentLoop.ts`, `src/agent/planner.ts`, `src/agent/agent.ts`, `src/state/settingsStore.ts` | Agent loop diverted tasks into un-mocked experimental reasoner; Tier-0 offline intents removed; YouTube & WhatsApp multi-step flows stripped; NVIDIA llama-3.1-8b sunset on 2026-08-26 | Restored standard AgentLoop and complete deterministic Planner flows; restored Tier-0 offline intents in agent.ts and router; updated default model to meta/llama-3.3-70b-instruct; 177/177 tests green |

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

---

## Logged Defects

### [BUG-001] YouTube is opened many times but never searched or played

- **Severity:** P0 (agent relaunch loop)
- **Status:** Verified
- **Component:** `src/agent/agent.ts`, `src/agent/planner.ts`
- **Reproduction Steps:**
  1. On a real device, say "Open YouTube and play Taarak Mehta funny episode."
  2. FRIDAY opens YouTube, then opens it again, and again.
- **Expected Behavior:** Launch YouTube once, search the requested title, tap the first result, verify playback, then confirm.
- **Actual Behavior:** YouTube is relaunched every step; no search is typed and nothing plays. Ends with "I opened YouTube but couldn't confirm the video started playing, Boss."
- **Root Cause Analysis:** Two compounding defects:
  1. `FridayAgent.executeGoal` never checked `AccessibilityModule.isServiceEnabled()` before running screen-control goals. When the service is disabled (or `rootInActiveWindow` is momentarily null), `inspectScreen()` honestly returns `activePackage: 'unknown'`.
  2. The planner's `MEDIA_PLAYBACK`/`MESSAGING` branches emitted `launch_app` on **every** step where the target app was not the foreground package. With `activePackage` stuck at `'unknown'`, that condition was always true, so YouTube was relaunched until `maxSteps` (12) was hit — violating FR-3.4 (max 3 retries/step) and NFR-3 (30 s task cap).
- **Fix & Regression Test:**
  - **Preflight gate** (`agent.ts`): for `MEDIA_PLAYBACK`/`MESSAGING`, if Accessibility is not enabled, open its settings, speak an actionable message, and stop honestly instead of looping.
  - **Anti-relaunch guard** (`planner.ts`): launch the target app exactly once, then wait up to 2 settle cycles (`wait_for_element`) for it to reach the foreground, then stop — never relaunch.
  - **Regression:** existing YouTube multi-step benchmark remains green with `isServiceEnabled` mocked to `true`.

### [BUG-002] Agent announces success without confirming the outcome

- **Severity:** P1 (honesty / false confirmation)
- **Status:** Verified
- **Component:** `src/agent/planner.ts`, `src/agent/task/taskManager.ts`, `src/agent/loop/agentLoop.ts`
- **Reproduction Steps:**
  1. Ask "play <title> on YouTube" (or "send hi to <contact> on WhatsApp").
  2. The agent taps the result / Send, then immediately speaks "Playing that for you now, Boss." / "Your message has been sent, Boss."
- **Expected Behavior:** Only claim success after real, observable evidence — playback actually active (audio or transport controls) or the message actually in the thread (delivered/read marker). Otherwise say it could not confirm.
- **Actual Behavior:** A tap was treated as proof. The `MEDIA_PLAYBACK` branch returned `{toolName:'none'}` right after `click_first_result`, and `MESSAGE_SENT` accepted `click_send_button` alone — both flipping `task.verified = true` with no confirmation.
- **Root Cause Analysis:** Clicking is not evidence. An ad, a load error, a mis-tap, or a pending network all look identical at click time, but the planner short-circuited to a spoken success and the terminal check rubber-stamped the click.
- **Fix & Regression Test:**
  - **Bounded verification loops** (`planner.ts`): after a result click, run `verify_playback_active` → `wait_for_element('pause')` (≤3 attempts) → final verify; after `click_send_button`, run `verify_message_sent` → `wait_for_element('delivered')` (≤2) → final verify. Neither branch ever returns `none`, so an unconfirmed task winds down to the loop's honesty gate.
  - **Evidence-based terminal conditions** (`taskManager.ts`): `PLAYBACK_ACTIVE` requires `isMediaPlaying` or a transport-control node; `MESSAGE_SENT` requires a `verify_message_sent` step **and** a visible delivered/sent/read marker.
  - **Regression:** new `verify_playback_active` / `verify_message_sent` reasoning covered by tests; full suite green.

### [BUG-003] Assistant silent when speaking "wake up" / "hey friday" / "friday" greetings

- **Severity:** P1 (wake-word / speech response stall)
- **Status:** Verified
- **Component:** `src/agent/providers/intentFastPath.ts`, `src/voice/tts.ts`, `src/voice/voicePipeline.ts`, `android/app/src/main/java/com/friday/services/FridayForegroundService.kt`
- **Reproduction Steps:**
  1. Say "wake up" or "hey friday" or "friday" or "who are you".
  2. FRIDAY does not speak or start talking.
- **Expected Behavior:** Immediately respond with natural conversational voice in English (e.g. "Online and ready, Boss. What's the play?").
- **Actual Behavior:** VAD detector dropped audio during `AudioRecord` -> `SpeechRecognizer` handoff causing speech timeout, while Tier-0 intent fast-path lacked greeting/wake patterns.
- **Root Cause Analysis:**
  1. `WakeWordDetector` used energy VAD that stopped `AudioRecord` upon detecting sound and then launched `SpeechRecognizer`, by which time short wake phrases had already completed, causing `SpeechRecognizer` to timeout on silence.
  2. `intentFastPath.ts` lacked deterministic offline entries for wake up, greetings ("hello", "good morning"), status ("how are you"), identity ("who are you"), and features ("what can you do").
  3. `TTSTurboModule` lacked fallback to system default engine if `com.google.android.tts` failed on non-Google devices.
- **Fix & Regression Test:**
  - Added comprehensive Tier-0 fast-paths for wake words, attention triggers, greetings, identity, capabilities, and appreciation in English.
  - Re-architected `FridayForegroundService` to run continuous `SpeechRecognizer` with real-time partial wake word matching.
  - Added engine fallback in `TTSTurboModule` and safety timeouts in `PocketTTSEngine.speak`.

### [BUG-005] Groq TTS 400 Bad Request (model terms required / playai decommissioned)

- **Severity:** P1 (audio speech synthesis failure)
- **Status:** Verified
- **Component:** `android/app/src/main/java/com/friday/modules/TTSTurboModule.kt`, `src/voice/tts.ts`
- **Reproduction Steps:**
  1. Issue any conversational query to FRIDAY requiring spoken response.
  2. App logs HTTP 400 Bad Request error from Groq audio speech endpoint ("model requires agreeing to terms" / deprecated PlayAI model ID).
- **Expected Behavior:** Fast, high-fidelity neural audio output synthesized aloud without requiring third-party subscription terms or failing silently.
- **Actual Behavior:** TTS synthesis threw HTTP 400 errors, leaving FRIDAY completely mute or hanging UI completion promises.
- **Root Cause Analysis:**
  1. Cloud inference providers (Groq) periodically change licensing agreements, decommission third-party TTS models (such as PlayAI or Whisper-TTS endpoints), or mandate web console terms acceptance for individual API keys.
  2. Relying on remote paid REST APIs for primary TTS synthesis introduced single-point failure, API billing risk, latency spikes, and fragile key dependency for the core speech interface.
- **Fix & Regression Test:**
  - Built direct Microsoft Edge Neural WebSocket streaming inside `TTSTurboModule.kt` utilizing the trusted client token protocol and SHA-256 `Sec-MS-GEC` token generation.
  - Selected the authentic Marvel F.R.I.D.A.Y. voice: `en-IE-EmilyNeural` (Kerry Condon's Irish accent) with customized SSML prosody parameters (`rate="+0%" pitch="+0Hz"`).
  - Implemented binary audio chunk streaming to a local cache directory (`reactContext.cacheDir`) with instant `MediaPlayer` playback on `AudioAttributes.USAGE_ASSISTANT`.
  - Added persistent LRU file caching for recurring phrases (`<140` chars) to eliminate network latency on frequent affirmations and wake greetings.
  - Built automatic fallback to Android OS built-in `TextToSpeech` if network is disconnected.

### [BUG-006] Double-verification wake deadlock and acoustic false triggers

- **Severity:** P1 (wake-word reliability & continuous command execution)
- **Status:** Verified
- **Component:** `android/app/src/main/java/com/friday/services/FridayForegroundService.kt`, `src/voice/voicePipeline.ts`, `src/voice/actionSafetyGuard.ts`
- **Reproduction Steps:**
  1. Say "Friday, open YouTube and play song" in a single breath.
  2. FRIDAY either dropped the audio because the VAD handoff stopped recording before speech finished, or triggered a wake prompt ("Yes, Boss?") that collided with and swallowed the user's spoken command.
  3. Ambient room noise (TV, background chatter) occasionally triggered wake detections on partial syllable matches.
- **Expected Behavior:** Single-breath commands ("Friday, open YouTube") execute directly without interrupting the user; standalone wake triggers ("Hey Friday") trigger a brief tactical prompt; ambient noise is rejected cleanly.
- **Actual Behavior:** Two-stage wake architecture (Energy VAD -> kill recording -> initialize SpeechRecognizer -> listen again) caused audio loss during the handoff gap, while partial keyword matching without intent filtering led to false triggers.
- **Root Cause Analysis:**
  1. Stopping the microphone upon energy detection to switch from raw PCM recording to Android `SpeechRecognizer` introduced an unavoidable 100–300ms Audio HAL latency gap, cutting off the start of the user's actual command.
  2. The pipeline treated every wake event identically, always playing an acknowledgment greeting ("Yes, Boss?") which talked over the user if they had already spoken their command in the same breath.
  3. Lack of semantic noise validation allowed isolated filler tokens ("um", "ah", "the") or background television audio to trigger agent execution.
- **Fix & Regression Test:**
  - Re-architected `FridayForegroundService.kt` to maintain a unified 24/7 continuous STT pipeline with real-time partial transcript streaming and `AdaptiveEndpointer`.
  - Implemented fuzzy phonetic prefix parsing (`checkWakeWord`) capable of splitting `"friday, <command>"` into the wake keyword and actionable command payload.
  - Introduced `ActionSafetyGuard.ts` in the TypeScript layer to categorize utterances into `NOISE`, `STOP`, `INCOMPLETE_ACTION`, `CONVERSATIONAL`, or `ACTIONABLE`.
  - Configured single-breath compound execution: when an actionable or conversational command is present after the wake word, FRIDAY executes the goal immediately with zero intermediate wake greeting interruptions.
  - Standalone wake words ("Hey Friday") transition to `WAKE_DETECTED` and speak a tactical acknowledgment before opening the multi-turn session.

### [BUG-021] Privileged IPC Stream Deadlocks, Shell Command Injection & Shizuku Lifecycle Risks

- **Severity:** P0 (IPC Deadlock, Process Leak & Shell Injection Security)
- **Status:** Verified
- **Component:** `android/app/src/main/java/com/friday/modules/RootControlTurboModule.kt`, `src/native/RootControlModule.ts`, `src/tools/rootControlTools.ts`, `src/agent/loop/stepExecutor.ts`, `android/app/src/main/AndroidManifest.xml`
- **Reproduction Steps:**
  1. Execute elevated shell command producing large (>64KB) stderr output before closing stdout: Kotlin thread deadlocks on sequential `readText()` calls.
  2. Call `inputText` with multi-line text (e.g. `"hello\nreboot"`): newline breaks out of single-quoted `input text '...'` shell command and executes `reboot`.
  3. Call `kill_app_silent` with malicious package name (e.g. `"com.app; reboot"`): unvalidated string directly interpolated into `am force-stop`.
  4. Call `elevated_tap` with negative numbers or NaN: passes invalid floats to shell input tap.
  5. Shizuku manager dialog dismissed or server dies: listener leaked, React promise hangs indefinitely.
- **Expected Behavior:** Concurrent, non-blocking stream drainage; guaranteed process cleanup in `finally` blocks; strict regex validation on package and permission strings; sanitization of control chars/newlines; Shizuku lifecycle timeout and Binder dead listener; explicit error propagation on elevated fallback failures.
- **Actual Behavior:** Sequential stream reading blocked on OS pipe buffer; processes leaked without `destroy()`; raw strings interpolated into shell; missing `moe.shizuku.manager.permission.API_V23` permission in `AndroidManifest.xml`.
- **Root Cause Analysis:**
  1. Sequential `process.inputStream.readText()` then `process.errorStream.readText()` created a classic Java `Process` pipe deadlock when the kernel buffer filled.
  2. `executeCommandAndResolveBoolean` never consumed or closed process standard streams.
  3. Kotlin and TS layers lacked regex validation on package and permission names, permitting arbitrary shell parameter concatenation.
  4. `AndroidManifest.xml` was missing Shizuku's required `moe.shizuku.manager.permission.API_V23` permission declaration.
- **Fix & Regression Test:**
  - Implemented non-blocking concurrent stream draining via `async(Dispatchers.IO)` and guaranteed `destroyProcessSafely()` in `finally` blocks.
  - Added strict regex validation (`PACKAGE_NAME_REGEX`, `PERMISSION_REGEX`) and input coordinate checks (`NaN`, `Infinity`, `< 0`).
  - Added control character and newline sanitization for `inputText` / `elevated_text`.
  - Added `moe.shizuku.manager.permission.API_V23` in `AndroidManifest.xml`.
  - Added 30-second watchdog and `Shizuku.OnBinderDeadListener` in `requestShizukuPermission`.
  - Enhanced `StepExecutor` error propagation when elevated fallback fails.
  - Comprehensive unit and edge-case test suite (`rootControl.test.ts`) covering all 177 tests green.

### [BUG-022] Autonomous Loop Regression & Deprecated NVIDIA Model (HTTP 410 Gone)

- **Severity:** P0 (Agent Loop Hijack & Model EOL Failure)
- **Status:** Verified
- **Component:** `src/agent/loop/agentLoop.ts`, `src/agent/planner.ts`, `src/agent/agent.ts`, `src/state/settingsStore.ts`, `src/agent/providers/providerRouter.ts`
- **Reproduction Steps:**
  1. Ask "Open YouTube and search Taarak Mehta funny episode and play it" or "wake up" or "who are you".
  2. Agent fails, returns empty array of steps, or throws NVIDIA 410 Gone / Groq 429 rate limit errors.
- **Expected Behavior:** Multi-step YouTube playback, WhatsApp messaging, offline wake-word recognition, and persona queries execute seamlessly with deterministic planning and active LLM fallback.
- **Actual Behavior:** Tasks were intercepted by an experimental reasoner making un-mocked raw LLM calls; Tier-0 intent fast-path was missing from `agent.ts`; `planner.ts` flows were stripped; NVIDIA's `meta/llama-3.1-8b-instruct` was sunset on 2026-08-26 returning HTTP 410.
- **Root Cause Analysis:**
  1. `agentLoop.ts` diverted all non-system control tasks into an experimental `AutonomousMobileReasoner` that attempted un-throttled ReAct calls.
  2. `resolveIntent` was removed from `FridayAgent.executeGoal`, preventing offline greetings and persona answers.
  3. `Planner.ts` lost its deterministic `MEDIA_PLAYBACK`, `MESSAGING`, and `ResultRanker` flows.
  4. NVIDIA API deprecated `meta/llama-3.1-8b-instruct`.
- **Fix & Regression Test:**
  - Restored `AgentLoop.run` with proper step execution, animation settle delays, and outcome verification.
  - Restored deterministic YouTube playback, WhatsApp messaging, and `ResultRanker` heuristics in `Planner.ts`.
  - Re-enabled Tier-0 `resolveIntent` fast-paths in `FridayAgent.executeGoal` and `ProviderRouter`.
  - Updated default NVIDIA model to `meta/llama-3.3-70b-instruct`.
  - Cleaned up unused experimental files.
  - Verified 100% green test suite across all 11 suites and 177 tests.