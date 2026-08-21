# FRIDAY — Remote Backend Architecture (VPS / Cloud Brain)

---

## 1. Zero-Laptop Production Philosophy

The user's development laptop must never be required to run FRIDAY in production.
- The **Android Phone** is the primary autonomous execution client.
- The optional **Remote VPS Backend** runs on a persistent cloud server (Docker on Ubuntu VPS), accessible 24/7 over secure HTTPS/WSS.

---

## 2. Backend Responsibilities

```text
               ┌───────────────────────────────┐
               │    FRIDAY Android Client      │
               └───────────────┬───────────────┘
                               │
                Secure WebSockets / TLS REST
                               │
                               ▼
               ┌───────────────────────────────┐
               │     FastAPI VPS Gateway       │
               ├───────────────────────────────┤
               │ • Device Auth & Token Auth    │
               │ • Secure API Key Vault        │
               │ • Model Provider Proxy (Groq) │
               │ • Long-term Memory Sync       │
               │ • Web Search / Tool Gateway   │
               └───────────────────────────────┘
```

The VPS backend acts strictly as a brain/proxy; it **never remote-controls the phone**. It returns structured action plans to the phone, which executes them locally.