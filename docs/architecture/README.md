# Orbit architecture

## System overview

```
┌──────────────────────── Browser ────────────────────────┐
│ React + Vite (apps/web)                                  │
│  Landing · Auth · Onboarding · Mission Control · Universe│
│  Journey · Discover · Progress · Profile · Settings      │
│  Agent drawer (everywhere) · Command palette · PWA       │
│  TanStack Query (server state) · Zustand (UI state)      │
└──────────────┬───────────────────────────────────────────┘
               │ REST /api  (Bearer JWT: Supabase or Orbit)
┌──────────────▼───────────────────────────────────────────┐
│ NestJS (apps/api)                                         │
│  Global: AuthGuard · ThrottlerGuard · ValidationPipe       │
│          response envelope · safe exception filter        │
│  Domain modules (src/modules/*)                            │
│  Scheduler (notifications cron)                            │
└──────┬──────────────────────┬──────────────────┬─────────┘
       │ Prisma               │ HTTP             │ HTTP
┌──────▼─────────┐   ┌────────▼─────────┐  ┌─────▼──────────────────────┐
│ PostgreSQL 16  │   │ Langflow          │  │ AI provider abstraction    │
│ + pgvector     │   │ Orbit Agent flow  │  │ Ollama · Groq · watsonx     │
│ (Supabase or   │   │  └ Orbit Career   │  │ (CV extraction, direct      │
│  local docker) │   │    Tools ─────────┼─▶│  agent loop, explanations)  │
└────────────────┘   └───────────────────┘  └────────────────────────────┘
                       tools call back: POST /api/agent/tools/:tool
```

## API modules

| Module | Responsibility |
| --- | --- |
| `auth`, `users` | Sign-up/sign-in (local JWT or Supabase JWT verification), user resolution |
| `profiles`, `skills`, `career` | Career profile, CV analysis, experiences, education, achievements, skills, goals and roles; Career Intelligence |
| `readiness` | Deterministic Career Readiness Engine + snapshots |
| `graph` | Career graph builder, persisted `GraphNode`/`GraphEdge`, Universe API |
| `journeys`, `quests` | Journey planner, milestones, quests, tasks, evidence, XP |
| `opportunities`, `discover`, `recommendations` | Job providers, job matching, growth/knowledge/people discovery, vector + rule ranking |
| `applications` | Saved opportunities, application pipeline, interview practice |
| `notes` | Career journal and pattern insights |
| `notifications` | In-app notifications, reminders, scheduled rules |
| `progress` | Progress analytics, timeline, gamification, next best action, Mission Control |
| `agent`, `ai` | Context builder, tool registry, Langflow client, direct loop, planner, action executor, audit |
| `files`, `search`, `health` | Uploads (Supabase Storage or local), global search, health checks |

## Data model

36 Prisma models (`apps/api/prisma/schema.prisma`), grouped as:

- **Identity & profile**: `User`, `CareerProfile`, `Education`, `Experience`, `Achievement`, `Skill`, `UserSkill`, `StoredFile`
- **Career targets**: `CareerRole`, `RoleSkillRequirement`, `CareerGoal`
- **Journey**: `CareerJourney` → `Milestone` → `Quest` → `QuestTask`, `QuestProgress`, `QuestEvidence`
- **Opportunities & knowledge**: `Opportunity`, `Book`, `ResearchPaper`, `Event`, `Resource`, `RoleModel`, `SavedOpportunity`, `Application`, `InterviewSession`
- **Memory & graph**: `CareerNote`, `GraphNode`, `GraphEdge`, `ReadinessSnapshot`, `ActivityLog`, `Notification`
- **Agent**: `AgentConversation`, `AgentMessage`, `AgentInsight`, `AgentAction`

Embeddings (`vector(768)`) live on profile and content tables for semantic candidate generation. The career graph stays in PostgreSQL; there is no separate graph database.

## Key flows

### Onboarding and CV processing

```
PDF upload → magic-byte sniffing + size limit → storage → text extraction
  → structured extraction (AI when available, heuristic parser otherwise) → Zod validation
  → profile, skills, experiences, education → readiness snapshot → career graph → Career Intelligence
```

### Career Readiness (deterministic)

Six categories, each a 0–1 ratio, weighted (configurable with `READINESS_WEIGHTS`, renormalised to 1):

| Category | Weight | Signals |
| --- | --- | --- |
| Skill match | 30% | Importance-weighted skill levels vs. role requirements |
| Experience match | 25% | Role experience signals (type + keywords), tenure, experience quests |
| Portfolio | 15% | Projects, awards, portfolio quests, evidence, public links |
| Knowledge | 10% | Completed books/papers/courses, certifications, learning quests |
| Application readiness | 10% | CV, profile completeness, links, active applications |
| Interview readiness | 10% | Communication skills, practice sessions, coaching scores |

The LLM explains the score but never computes it.

### Job matching

Candidates come from structured filters and vector similarity, then are ranked deterministically: role alignment 25%, skill match 25%, experience 20%, preferences 15%, career goal 15%. Each match returns component scores, matched and missing skills, reasons and a recommended action.

### Agent turn

```
message + page context
  → context package (role, readiness, top gaps, current quest, applications, recent insights)
  → engine: Langflow │ direct model tool loop │ deterministic planner
  → tools (READ run immediately; SUGGEST/WRITE create AgentAction cards)
  → answer (Insight · Why it matters · Next best action · Expected impact) + cards
  → user confirms → ActionExecutor runs the change → graph, readiness and progress update
```

Langflow is skipped when its model is the local Ollama model and Orbit has measured it as too slow for the time budget, and for five minutes after a failed run. Users never wait on a dead engine.

## Security

- JWT verification on every non-public route (Supabase JWKS/secret or Orbit's own key); every query is filtered by the authenticated user id.
- Langflow → API tool calls use a separate shared secret (`x-orbit-tool-key`, timing-safe comparison) and a conversation id; they never carry user tokens.
- Global `ValidationPipe` (whitelist, forbid unknown fields), DTOs with class-validator, Zod for AI output.
- Upload validation by magic bytes and size; private file access through authenticated download.
- Helmet, CORS limited to `FRONTEND_URL`, rate limiting (stricter on `/agent/chat`), safe error envelope with no stack traces.
- Secrets live only in server env; the web bundle sees only `VITE_*` public values. Exported Langflow flows reference credential variables by name.

## Frontend structure

```
apps/web/src
├── features/        one folder per screen (landing, auth, onboarding, mission, universe, journey, discover, progress, profile, settings)
├── components/      ui primitives (Radix-based), layout (AppShell, CommandPalette), agent drawer, brand, shared states
├── hooks/queries.ts TanStack Query hooks + mutations (cache invalidation keeps Universe, Journey and readiness in sync)
├── stores/          session (persisted) and UI (agent drawer, theme, page context)
└── lib/             API client, auth adapter, icons, utils
```

Theming uses CSS variables on `:root` and `.dark` mapped into Tailwind tokens. The theme toggle applies a View Transitions circular reveal (skipped for reduced motion), and canvas-based views (Universe graph, charts) receive the resolved theme explicitly.
