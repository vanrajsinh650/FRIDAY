# FRIDAY — Model Provider Architecture

---

## 1. Model Provider Abstraction Interface

FRIDAY is never hardcoded to a single LLM vendor. The architecture uses a unified
provider interface. As of the perception upgrade, message content is multimodal
(text or text+image parts) so vision-capable providers can receive screenshots
on demand.

```typescript
// src/agent/providers/types.ts
export type MessageContentPart = TextContentPart | ImageContentPart;

export interface ModelMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | MessageContentPart[]; // widened for vision
  tool_calls?: any[];
}

export interface ModelProvider {
  name: string;
  supportsVision?: boolean;                // true for VLM-backed providers
  generateText(messages: ModelMessage[], options?: { temperature?: number }): Promise<string>;
  generateToolCall(messages: ModelMessage[], tools: any[]): Promise<ToolCallResult>;
  reasonToolCall?(messages: ModelMessage[], tools: any[]): Promise<ToolCallResult>; // network tail, no fast-path
}
```

Helpers `extractText(content)`, `hasImageContent(messages)`, and
`toImageDataUrl(base64Jpeg)` bridge the string and multimodal representations.

---

## 2. Tiered Reasoning Router

`ProviderRouter` (`src/agent/providers/providerRouter.ts`) is itself a
`ModelProvider`, so the rest of the agent is unaware of tiering. It resolves
exactly one tier per call — "never everything at once":

- **Tier 0 — `resolveIntent` (`intentFastPath.ts`)**: a provider-agnostic
  deterministic intent ladder (app launch, wifi/bt/hotspot, notifications,
  memory, alarms, torch/battery/brightness/ringer/volume, time, persona, scroll,
  back, click, type, screen inspection, call/sms, installed apps, home). Runs
  offline at zero latency and is why the deterministic test suite stays green
  regardless of which network provider is primary.
- **Tier 1+ — network reasoners in priority order**: iterates
  `[primary, ...fallbacks]`, calling each provider's `reasonToolCall` (falling
  back to `generateToolCall`). The first *confident* answer wins. A reasoner that
  throws or returns the bare `inspect_screen` non-answer sentinel is skipped so
  the next one gets a turn. If every reasoner fails, the router returns
  `inspect_screen` rather than fabricating an action.

Text-only fallbacks never receive image parts: the router strips them
(`stripImageParts`) so a non-vision provider still gets the full
accessibility-tree text.

`ProviderFactory.createDefault()` reads `defaultModelProvider` as the primary and
builds the chain from preference order `['nvidia','groq','openai','local']`.

---

## 3. Provider Implementations & Roles

| Provider | Model | Vision | Primary Role |
| :--- | :--- | :--- | :--- |
| **NvidiaProvider** | Llama 3.3 70B (text) / Llama 3.2 90B Vision | ✅ | **Primary reasoner & "eyes"** |
| **GroqProvider** | Llama 3.3 70B | ❌ | Fast text fallback (rich fast-path) |
| **OpenAIProvider**| configurable | (model-dependent) | Complex reasoning fallback |
| **LocalProvider** | Llama.cpp / Ollama | ❌ | Offline last resort |

NvidiaProvider selects its model per call via `modelFor(messages)`:
`nvidiaVisionModel` (default `meta/llama-3.2-90b-vision-instruct`) when the
messages carry an image, else `meta/llama-3.3-70b-instruct`. It **throws** on a
hard failure (non-ok response / empty answer) so the router can fall back, and
returns `{ toolName: 'none', parameters: { reply } }` when the model responds
with prose instead of a tool call.

---

## 4. On-Demand Vision Perception

The accessibility tree is the primary, cheapest perception path. A screenshot is
attached only when `VisionPerception.augment` (`src/agent/perception/visionPerception.ts`)
determines the tree is *sparse* (unknown active package or ≤1 informative node)
**and** `visionFallbackEnabled` is set — then it captures one JPEG via
`AccessibilityModule.captureScreenBase64()` and folds it into the last user turn
as an `image_url` content part. It is inert in tests (native capture returns an
empty string) and never fires per-frame.
