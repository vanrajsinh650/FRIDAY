# FRIDAY — Performance Engineering & Latency Budgets

---

## 1. Performance KPIs & Budgets

| Metric | Target (P50) | Upper Limit (P95) | Optimization Strategy |
| :--- | :--- | :--- | :--- |
| **Wake Word Latency** | 80ms | 140ms | On-device Porcupine DSP engine |
| **STT First Token** | 180ms | 300ms | Streaming WebSockets / Local Sherpa-ONNX |
| **Time to First Action (TTFA)** | **450ms** | **750ms** | Speculative app launch while LLM reasons |
| **LLM TTFT** | 220ms | 450ms | Groq Llama 3.3 70B inference engine |
| **TTS First Audio Chunk** | 120ms | 220ms | Pocket-TTS local CPU chunk streaming |
| **UI Node Tree Pruning** | 25ms | 50ms | In-memory Kotlin filtering of empty nodes |
| **Total Voice Loop** | **< 600ms** | **< 1000ms** | End-to-end pipelined streaming |

---

## 2. Battery & Memory Budgets

- **Standby Battery:** < 1.2% per hour with wake-word active.
- **Active Task Battery:** < 4% per hour during heavy multi-step automation.
- **RAM Footprint:** < 180MB baseline resident set size (RSS).