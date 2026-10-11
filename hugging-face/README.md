---
title: Orbit Langflow
emoji: 🪐
colorFrom: indigo
colorTo: purple
sdk: docker
app_port: 7860
pinned: false
short_description: Langflow engine for the Orbit Career Agent
---

# Orbit Career Agent — Langflow

The Langflow engine behind **Orbit**, an AI career and personal growth agent.

```
Orbit web ─▶ Orbit API (NestJS, Vercel) ─▶ this Space: POST /api/v1/run/{flow}
                                              │
   Chat Input ─▶ Agent (Groq, Llama 3.3 70B) ─▶ Chat Output
                   ▲
                   Orbit Career Tools ──▶ Orbit API /api/agent/tools/*
```

- One orchestrator agent with 14 Orbit career tools (profile, gaps, opportunities, journey, progress, reminders, ...).
- The flow is built on every boot by `orbit/bootstrap.py` from Langflow's own component templates.
- The API requires an API key and the UI requires a login. Users never talk to this Space directly; only the Orbit API does.

Deployment guide: [`DEPLOYMENT.md`](DEPLOYMENT.md).
