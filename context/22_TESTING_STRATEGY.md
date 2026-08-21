# FRIDAY — Testing Strategy & Benchmark Verification

---

## 1. Multi-Tiered Testing Pyramid

```text
               ┌───────────────────────────────┐
               │    End-to-End Phone Tasks     │ (Real Android Device Benchmarks)
               ├───────────────────────────────┤
               │   Android Instrumentation     │ (Accessibility & Gesture Tests)
               ├───────────────────────────────┤
               │    Agent & Planner Tests      │ (Simulated UI Tree & Intent Tests)
               ├───────────────────────────────┤
               │     TypeScript Unit Tests     │ (State Stores, Tools, Formatters)
               └───────────────────────────────┘
```

---

## 2. Standard Acceptance Benchmark Suite

| Benchmark ID | Intent / Task | Success Verification Criteria |
| :--- | :--- | :--- |
| **BENCH-01** | *"Open YouTube, search Taarak Mehta, play top episode"* | YouTube foregrounded, search executed, video player loaded, playback active. |
| **BENCH-02** | *"Send WhatsApp message to Mom: 'Arrived safely'"* | WhatsApp opened, contact located, message typed & sent, checkmark verified. |
| **BENCH-03** | *"Set an alarm for 6:45 AM and turn on flashlight"* | Alarm registered in system Clock, flashlight hardware turned on, voice confirmed. |
| **BENCH-04** | *"What is my battery level and screen brightness?"* | Reads battery level (%) and brightness (%) via system APIs and speaks aloud. |
| **BENCH-05** | *"Open Maps and navigate to nearest coffee shop"* | Maps opened, search query executed, first result navigation started. |