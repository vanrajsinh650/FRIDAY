# FRIDAY — Agent Architecture & Core State Machine

---

## 1. DeepSeek Harness Inspiration & Core Subsystems

FRIDAY adapts key architectural ideas from **DeepSeek Harness** (dynamic prompt assembly, plugin tool registry, planning/execution separation, runtime context injection), implemented natively in TypeScript for real-time mobile execution.

```text
                               ┌────────────────────────┐
                               │   User Goal (Voice)    │
                               └───────────┬────────────┘
                                           │
                                           ▼
                               ┌────────────────────────┐
                               │    Context Manager     │
                               │ Screen State + Memory  │
                               └───────────┬────────────┘
                                           │
                                           ▼
                               ┌────────────────────────┐
                               │        Planner         │
                               │ Intent + Atomic Steps  │
                               └───────────┬────────────┘
                                           │
                                           ▼
                               ┌────────────────────────┐
                               │    Execution Engine    │
                               │  Priority Tool Runner  │
                               └───────────┬────────────┘
                                           │
                                           ▼
                               ┌────────────────────────┐
                               │  Verification Engine   │
                               │  Did state transition? │
                               └───────────┬────────────┘
                                           │
                    ┌──────────────────────┴──────────────────────┐
                    ▼                                             ▼
            [Verified: Success]                          [Failed: Re-plan]
                    │                                             │
                    ▼                                             ▼
          Speak confirmation to User                     Try Alternate Tool / Bounded Retry
```

---

## 2. The Core Agent Loop

The execution cycle follows strict state validation:
```text
1. OBSERVE: Query AccessibilityModule.inspectScreen() -> parse active package, clickable nodes, text content.
2. REASON: Inject active goal + compacted UI tree + user memory into ModelProvider.
3. PLAN: Generate 1-3 immediate atomic actions (e.g. `launch_app(pkg)` or `click_node(id)`).
4. ACT: Dispatch action through ExecutionEngine via the fastest mechanism.
5. OBSERVE AGAIN: Wait for UI event or short settle delay (150ms), re-inspect screen.
6. VERIFY: Evaluate verification predicate (e.g., did the search results page appear? Did playback start?).
7. COMPLETE / RECOVER: If verified, continue to next step or report success. If failed, trigger bounded recovery (max 3 retries).
```

---

## 3. Dynamic Tool Registry

```typescript
// src/agent/types.ts
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required: string[];
  };
  execute: (params: any) => Promise<{ success: boolean; data?: any; error?: string }>;
}
```

Registered core capabilities include:
- `launch_app`: Direct Android launch intent.
- `click_node`: Click an accessibility node by ID or label.
- `type_text`: Input string into active text field.
- `scroll_page`: Scroll down/up to reveal off-screen items.
- `inspect_screen`: Retrieve current semantic UI hierarchy.
- `system_control`: Change volume, brightness, Wi-Fi.
- `verify_state`: Check if specific text/elements exist on screen.