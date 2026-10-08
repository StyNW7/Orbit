# Orbit Career Agent on Langflow

Orbit uses **one orchestrator agent** built in Langflow. It reasons over the user's context package and calls **Orbit Career Tools**, which call back into the NestJS API. The browser never talks to Langflow.

```
Orbit web ─▶ NestJS /agent/chat ──(context package + message, session_id = conversation id)──▶ Langflow /api/v1/run/{flow}
                                                                                                   │
   Chat Input ─▶ Agent (orbit-system-prompt.md) ─▶ Chat Output                                     │
                   ▲                ▲                                                              │
     Language model (Ollama/Groq/   Orbit Career Tools ──POST /api/agent/tools/{tool}──▶ NestJS ◀─┘
     watsonx)                       x-orbit-tool-key + session_id
```

## Files

| Path | Purpose |
| --- | --- |
| `flows/orbit-agent.json` | Exported flow, importable through the Langflow UI (Upload → flow). Contains no secrets: API keys are referenced by Langflow variable name |
| `prompts/orbit-system-prompt.md` | The agent's instructions (mirrors `apps/api/src/modules/agent/system-prompt.ts`) |
| `custom-components/orbit/orbit_career_tools.py` | The **Orbit Career Tools** component: reads `GET /agent/tools/manifest` and exposes each tool as a LangChain `StructuredTool` |
| `../../infra/scripts/langflow-setup.mjs` | Builds or updates the flow in a running Langflow and re-exports `orbit-agent.json` |

## Setup

1. Start the stack: `pnpm infra:up` (Langflow at http://localhost:7861). Compose mounts `custom-components/` as `LANGFLOW_COMPONENTS_PATH`, allows the `ollama` host (`LANGFLOW_SSRF_ALLOWED_HOSTS`) and keeps the Langflow database in the `orbit-langflow` volume.
2. Build the flow and save its id:

   ```bash
   pnpm langflow:setup -- --write-env
   ```

   The script reads `.env`, signs in (auto-login or `LANGFLOW_API_KEY`), takes the real component templates from `GET /api/v1/all`, wires *Chat Input → Agent → Chat Output* with a language model and *Orbit Career Tools*, creates or updates the flow named **Orbit Career Agent**, exports it here, and writes `LANGFLOW_FLOW_ID` and `LANGFLOW_MODEL_PROVIDER` to `.env`.
3. Restart the API. **Settings → Orbit Career Agent** shows the active engine.

### Choosing the model

| `LANGFLOW_MODEL_PROVIDER` | Needs | Notes |
| --- | --- | --- |
| `ollama` (default) | `AI_MODEL` pulled in the `orbit-ollama` container | Fully local. On CPU-only machines it is too slow for live answers, so Orbit skips Langflow automatically and says why in Settings |
| `groq` | `GROQ_API_KEY` (optional `GROQ_MODEL`) | Fast, free tier. Uses Langflow's OpenAI component with Groq's OpenAI-compatible endpoint |
| `watsonx` | `WATSONX_API_KEY`, `WATSONX_PROJECT_ID` (optional `WATSONX_URL`, `WATSONX_MODEL`) | IBM Granite on watsonx.ai |

```bash
LANGFLOW_MODEL_PROVIDER=groq pnpm langflow:setup -- --write-env
```

Keys are stored as Langflow **credential variables** (`ORBIT_GROQ_API_KEY`, `ORBIT_WATSONX_API_KEY`), never inside the flow JSON.

### Building it by hand instead

1. New flow → add **Chat Input**, **Agent**, **Chat Output**, a model component (**Ollama** with `http://ollama:11434`, or **OpenAI** with base URL `https://api.groq.com/openai/v1`, or **IBM watsonx.ai**), and **Orbit Career Tools** (category *orbit*).
2. Connect Chat Input → Agent *Input*, model *Language Model* → Agent *Language Model*, Orbit Career Tools *Tools* → Agent *Tools*, Agent *Response* → Chat Output.
3. Paste `prompts/orbit-system-prompt.md` into the Agent's instructions.
4. Copy the flow id into `LANGFLOW_FLOW_ID`.

## How the tools work

- Orbit calls `POST /api/v1/run/{flowId}` with `session_id` set to the Orbit conversation id. The tool component reads that id from the graph and sends it with every call; the API resolves the user from it. Langflow never receives user credentials.
- Calls are authenticated with `ORBIT_TOOL_API_KEY` (`x-orbit-tool-key`), passed to the container through compose.
- 14 tools: `get_user_context`, `analyze_career_profile`, `analyze_career_gap`, `find_opportunities`, `search_growth_resources`, `search_books`, `search_papers`, `find_role_models`, `build_career_journey`, `update_career_graph`, `update_progress`, `manage_application`, `create_reminder`, `get_next_best_action`.
- **READ** tools return data. **SUGGEST** and **WRITE** tools only *propose* an `AgentAction`; the user confirms it on a card in the Orbit UI. Every call is written to the audit log.

## Reliability

Orbit treats Langflow as the preferred engine, not a single point of failure:

1. **Langflow** when configured, reachable and backed by a fast enough model.
2. **Direct model loop** through Orbit's own provider abstraction.
3. **Deterministic planner** that uses the same tools and always answers.

After a failed or timed-out Langflow run, chats skip Langflow for five minutes instead of waiting on it again.

## Testing a run directly

```bash
curl -X POST "http://localhost:7861/api/v1/run/$LANGFLOW_FLOW_ID?stream=false" \
  -H "Content-Type: application/json" \
  -d '{"input_value":"What should I focus on this week?","input_type":"chat","output_type":"chat","session_id":"<an Orbit conversation id>"}'
```

When called through the Orbit API the message is prefixed with the `[ORBIT CONTEXT]` package; direct calls like this one don't include it.
