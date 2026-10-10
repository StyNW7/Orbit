# Orbit 

**Build Your Path. Become Career-Ready.**

Orbit is an agentic career and personal-growth platform. It understands where you are, connects what can help you grow, and shows you what to do next.

Built for the IBM SkillsBuild National Hackathon 2026, track **Education & Future of Work**.

---

## Product vision

Career preparation is fragmented. Job boards, course platforms, papers, notes and chatbots each hold a piece, and none of them knows *you*. Orbit turns a person's CV, skills, experiences, goals, opportunities, knowledge and people into one connected **Career Universe**, then an AI Career Agent keeps answering a single question:

> How career-ready is this user, and what should they do next?

Everything in Orbit belongs to one of five core systems:

| System | What it does | Where |
| --- | --- | --- |
| **Career Intelligence** | Career DNA from the CV and goals; deterministic Career Readiness score | Onboarding, Profile, Mission Control |
| **Career Universe** | An orbital graph of you, roles, skills, gaps, experiences, opportunities, knowledge and people | Universe |
| **Opportunity Intelligence** | Explainable job matching, growth events, books, papers and role models | Discover |
| **Adaptive Career Journey** | Milestones → quests → tasks → evidence, with XP and readiness feedback | Journey, Progress |
| **Orbit Career Agent** | One orchestrator agent (Langflow) with 14 Orbit tools and human-in-the-loop confirmation | "Ask Orbit", available everywhere |

The core loop: **understand me → map my universe → discover opportunities → identify gaps → build my journey → take action → track progress → adapt.**

Design principle: *Bright, not noisy. Dynamic, not chaotic. Gamified, not childish. Intelligent, not complicated.*

## Features

- **Auth**: email/password via Supabase Auth, or built-in JWT auth when Supabase is not configured. Protected routes, session persistence.
- **Onboarding** in six short steps: target role, CV (PDF upload or paste), interests, preferences, context, analysis.
- **CV processing**: PDF text extraction → structured extraction (AI when available, heuristic fallback) → Zod validation → profile, skills, experiences, education → graph nodes.
- **Career Readiness Engine**: deterministic and configurable (Skill 30 · Experience 25 · Portfolio 15 · Knowledge 10 · Application 10 · Interview 10). Snapshots are stored for history. The LLM only explains the score.
- **Career Universe**: Sigma.js + Graphology orbital layout, search, six filters, zoom/pan/drag/focus, node details drawer with "Add to Journey".
- **Journey**: generated from role templates and your gaps; a serpentine roadmap (@xyflow/react); quests with tasks, evidence, deadlines and XP; multiple career orbits with one primary; a personal career journal with pattern insights.
- **Discover**: Jobs / Growth / Knowledge / People. Hybrid matching (Role 25 · Skill 25 · Experience 20 · Preference 15 · Goal 15) with "why you match", missing skills and next action. Pluggable, de-duplicated providers: curated seed data, Remotive, Arbeitnow and We Work Remotely (RSS) for jobs; Google Books and Open Library for books; OpenAlex and Semantic Scholar for papers.
- **Applications**: save → prepare → apply → interview → offer; deadline detection and reminders; interview practice with coaching indicators.
- **Notifications**: scheduler (`@nestjs/schedule`/cron) for deadlines, events, follow-ups and weekly reviews; in-app notification center; PWA-installable.
- **Progress**: readiness history, category radar, skills, quests, applications, Orbit Timeline, level, XP and streak.
- **Orbit Agent**: right-side drawer with page context, Markdown answers (Insight · Why it matters · Next best action · Expected impact), tool-call chips, actionable confirmation cards, and an audit log in Settings.
- **Light and dark mode**: one-click toggle on every page (landing, auth, onboarding, app) with a circular reveal animation, plus a System option in Settings and the account menu.
- **English & Bahasa Indonesia**: an EN | ID toggle on every page (also in Settings and the account menu). The choice is remembered per browser and sent to the API as `X-Orbit-Locale`, so Orbit Agent answers, the next best action, match reasons, recommendation reasons and onboarding analysis follow the same language. Dictionaries live in `apps/web/src/lib/i18n` (`id.ts` is type-checked against `en.ts`, so a missing translation fails the build); the API uses a request-scoped locale (`apps/api/src/common/i18n/locale.ts`). Catalog data (job descriptions, books, papers) keeps its original language.
- **New-user guidance**: a dismissible "Getting started" checklist on Mission Control, a **Guide** page (`/app/guide`) explaining every area, and a FAQ on the landing page.

## Architecture

```
React (Vite) ──▶ NestJS API ──▶ Prisma ──▶ PostgreSQL + pgvector (Supabase or local docker)
                    │
                    ├──▶ Langflow ──▶ Orbit Career Agent ──▶ Orbit Career Tools ──▶ NestJS /agent/tools/*
                    │                       └──▶ model: Ollama (local) · Groq · IBM watsonx.ai
                    └──▶ AI provider abstraction (CV extraction, explanations, direct agent fallback)
```

- The browser never talks to Langflow or a model; NestJS is the AI gateway.
- Before every agent call NestJS builds a compact **context package** (target role, readiness, top gaps, current quest, applications, recent insights). Long-term memory lives in PostgreSQL, not in chat history.
- **Agent fallback chain**: Langflow → direct model tool loop → deterministic planner. The agent always answers, and Orbit skips Langflow automatically when its model is measured as too slow on the current machine.
- **Human-in-the-loop**: READ tools run automatically; SUGGEST and WRITE tools create `AgentAction` cards that the user confirms or dismisses. Every action is audited.

More detail: [`docs/architecture/README.md`](docs/architecture/README.md) · Langflow: [`ai/langflow/README.md`](ai/langflow/README.md).

## Tech stack

| Layer | Technology |
| --- | --- |
| Web | React 19, Vite 6, TypeScript, Tailwind CSS 4, React Router 7, Radix UI primitives (shadcn-style), TanStack Query, Zustand, React Hook Form + Zod, Sigma.js + Graphology, @xyflow/react, Recharts, Motion, react-markdown, date-fns, Sonner, lucide-react, vite-plugin-pwa |
| API | NestJS 11, TypeScript, Prisma 6, PostgreSQL 16 + pgvector, class-validator, @nestjs/schedule, @nestjs/throttler, Helmet, jose (JWT) |
| Auth & storage | Supabase Auth + Storage (optional; local JWT + local file storage fallback) |
| AI | Langflow 1.12 (agent orchestration), Ollama (local Granite), Groq or IBM watsonx.ai (hosted), pgvector embeddings |
| Tooling | pnpm workspaces, Docker Compose, Jest, ESLint |

## Folder structure

```
.
├── apps/
│   ├── web/                 React app (features/, components/, hooks/, stores/, lib/)
│   └── api/                 NestJS API (src/modules/*, prisma/schema.prisma, prisma/seed.ts)
├── packages/
│   ├── shared/              Types, constants and helpers shared by web and API
│   └── config/              Shared TypeScript config
├── ai/langflow/
│   ├── flows/orbit-agent.json            Exported Orbit Career Agent flow
│   ├── prompts/orbit-system-prompt.md    Agent system prompt
│   ├── custom-components/orbit/          "Orbit Career Tools" Langflow component
│   └── README.md
├── infra/
│   ├── docker-compose.yml   postgres (pgvector), ollama, langflow
│   └── scripts/             langflow-setup.mjs, make-sample-cv.mjs
├── docs/                    architecture/, demo/ (sample CV)
├── .env.example
└── package.json
```

## Prerequisites

- Node.js 20+ and pnpm 9 (`corepack enable`)
- Docker Desktop (for PostgreSQL, Ollama and Langflow)
- Optional: a Supabase project, a Groq API key or IBM watsonx.ai credentials

## Getting started

```bash
pnpm install
cp .env.example .env                 # then review the values

pnpm infra:up                        # postgres + ollama + langflow (docker)
pnpm ollama:pull                     # granite3.3:2b + nomic-embed-text (first time only)

pnpm db:generate
pnpm db:migrate                      # applies the Prisma migrations (enables pgvector)
pnpm db:seed                         # roles, skills, jobs, books, papers, events, people, demo user

pnpm langflow:setup -- --write-env   # builds the Orbit Agent flow in Langflow, stores LANGFLOW_FLOW_ID

pnpm dev                             # web http://localhost:5173 · API http://localhost:4000/api
```

Open http://localhost:5173 and either sign up or use **Explore the demo account**.

### Demo account

| Email | Password |
| --- | --- |
| `demo@orbit.app` | `OrbitDemo2026!` |

The demo user, **Stanley Wijaya**, is a Computer Science student targeting Product Manager, with gaps in Product Analytics, SQL and professional product experience. A sample CV for the sign-up flow is in `docs/demo/sample-cv-stanley-wijaya.pdf` (also offered as "Use sample CV" during onboarding).

### Environment variables

All variables are documented in [`.env.example`](.env.example). The important ones:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL`, `DIRECT_URL` | PostgreSQL (local docker by default, or Supabase) |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET` | Supabase Auth/Storage. Leave empty to use built-in auth and local storage |
| `APP_JWT_SECRET` | Signing key for built-in auth. **Change it** outside local development |
| `LANGFLOW_BASE_URL`, `LANGFLOW_FLOW_ID`, `LANGFLOW_API_KEY` | Langflow connection (the flow id is written by `pnpm langflow:setup -- --write-env`) |
| `LANGFLOW_MODEL_PROVIDER` | `ollama` · `groq` · `watsonx`: the model the flow runs on |
| `ORBIT_TOOL_API_KEY` | Shared secret Langflow tool calls send to `/api/agent/tools/*`. **Change it** |
| `AI_PROVIDER`, `AI_MODEL` | Model for CV extraction and the direct agent fallback (`ollama`, `groq`, `watsonx`, `none`) |
| `GROQ_API_KEY`, `WATSONX_API_KEY`, `WATSONX_PROJECT_ID` | Hosted model credentials (server-only) |
| `ENABLE_EXTERNAL_PROVIDERS` | Use public book, paper and job APIs in addition to curated seed data |
| `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | The only values exposed to the browser |

Server secrets are never prefixed with `VITE_`.

### Supabase (optional)

1. Create a project and enable the `vector` extension (Database → Extensions).
2. Put the pooled connection string in `DATABASE_URL` and the direct one in `DIRECT_URL`.
3. Fill `SUPABASE_*` and `VITE_SUPABASE_*`; create a private storage bucket named `orbit-files`.
4. Run `pnpm db:deploy && pnpm db:seed`.

With Supabase configured, the web app signs in through Supabase Auth and NestJS verifies the JWT.

### Langflow and the AI model

`pnpm langflow:setup` assembles the flow from the component templates of the running Langflow, so it always matches the installed version. See [`ai/langflow/README.md`](ai/langflow/README.md) for the full guide.

- **Local (default)**: Ollama with `granite3.3:2b`. On CPU-only machines this is too slow for live agent answers, so Orbit answers with its direct/planner engines and shows why in **Settings → Orbit Career Agent**. A GPU (NVIDIA driver with CUDA 12+, uncomment the GPU block in `infra/docker-compose.yml`) makes it interactive.
- **Groq** (fast, free tier): set `GROQ_API_KEY`, then `LANGFLOW_MODEL_PROVIDER=groq pnpm langflow:setup -- --write-env`.
- **IBM watsonx.ai** (Granite): set `WATSONX_API_KEY` and `WATSONX_PROJECT_ID`, then `LANGFLOW_MODEL_PROVIDER=watsonx pnpm langflow:setup -- --write-env`.

Restart the API after changing `.env`.

## Commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | Shared package watcher + API + web with hot reload |
| `pnpm build` | Production builds of shared, API and web |
| `pnpm start` | Run the built API |
| `pnpm lint` · `pnpm typecheck` · `pnpm test` | Quality checks (Jest covers readiness, job matching, journey planning, graph building, agent confirmation, auth guard and DTO validation) |
| `pnpm db:generate` · `db:migrate` · `db:deploy` · `db:seed` · `db:reset` · `db:studio` | Prisma |
| `pnpm infra:up` · `infra:up:ai` · `infra:down` · `infra:logs` | Docker Compose |
| `pnpm langflow:setup [-- --write-env]` | Create or update the Orbit Agent flow and export it |
| `pnpm ollama:pull` | Pull the local chat and embedding models |

## Golden demo flow

1. Sign up, choose **Product Manager**, and use the sample CV.
2. Career Intelligence appears: readiness, strengths, main gaps, next best action.
3. **Universe**: search "Product Analytics", open the gap, then **Add to Journey**.
4. **Journey**: complete a task. Readiness and XP go up and the Universe updates.
5. **Discover**: the "Top picks" row shows an internship, an event, a book, a paper and a role model for your biggest gap. **Save & track** the Product Management Intern; Orbit detects the deadline and schedules a reminder.
6. **Ask Orbit**: "What should I focus on this week?" The answer uses your journey, gaps, application deadline and progress, and offers actionable cards.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| API cannot reach the database | `pnpm infra:up`; check `DATABASE_URL` points at port `54322` |
| `vector` type missing | Use the `pgvector/pgvector` image (compose default) or enable the extension in Supabase |
| Agent shows "Orbit planner" | Expected without a fast model. See Settings → Orbit Career Agent for the reason; configure Groq or watsonx |
| Langflow setup: "Orbit Career Tools not available" | `docker compose -f infra/docker-compose.yml up -d langflow` (the custom component folder must be mounted) |
| Langflow "SSRF Protection" error | `LANGFLOW_SSRF_ALLOWED_HOSTS` must include `ollama` (set in compose) |
| Flow disappeared after recreating Langflow | Compose stores the Langflow DB in the `orbit-langflow` volume; re-run `pnpm langflow:setup -- --write-env` |
| Demo login fails after re-seeding | The seed recreates the demo user; sign in again |

## Screenshots

_Add screenshots of Landing, Mission Control, Universe, Journey, Discover, Progress and the Agent drawer (light and dark) here._

## Roadmap

Recruiter views, social features, payments and native apps are intentionally out of scope for the MVP. Next: web push notifications, richer interview coaching, more job providers, and fine-tuned Granite prompts for the local model.
