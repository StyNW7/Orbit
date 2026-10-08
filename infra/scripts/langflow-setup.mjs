// Builds the Orbit Career Agent flow inside a running Langflow and exports it to
// ai/langflow/flows/orbit-agent.json.
//
//   pnpm langflow:setup                 create/update the flow, export JSON
//   pnpm langflow:setup -- --write-env  ...and store LANGFLOW_FLOW_ID in .env
//
// The flow is assembled from the component templates Langflow itself serves (GET /api/v1/all),
// so the JSON always matches the running Langflow version instead of being hand-written:
//
//   Chat Input ─▶ Agent (Orbit system prompt) ─▶ Chat Output
//                   ▲            ▲
//        Language model          Orbit Career Tools (14 tools → Orbit API)
//
// Model provider (LANGFLOW_MODEL_PROVIDER, falling back to AI_PROVIDER):
//   ollama   local model inside docker (default; slow on CPU-only machines)
//   groq     fast hosted open models — needs GROQ_API_KEY (free tier available)
//   watsonx  IBM watsonx.ai Granite — needs WATSONX_API_KEY + WATSONX_PROJECT_ID
// API keys are stored as Langflow *credential variables*; the exported JSON only holds their names.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const envPath = resolve(root, '.env');
const WRITE_ENV = process.argv.includes('--write-env');

function readEnv() {
  if (!existsSync(envPath)) return {};
  const out = {};
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

const env = { ...readEnv(), ...process.env };
const BASE = (env.LANGFLOW_BASE_URL || 'http://localhost:7861').replace(/\/$/, '');
// Inside docker compose, Langflow reaches Ollama by service name.
const OLLAMA_URL = env.LANGFLOW_OLLAMA_URL || 'http://ollama:11434';
const PROVIDER = ['ollama', 'groq', 'watsonx'].includes(env.LANGFLOW_MODEL_PROVIDER || env.AI_PROVIDER) ? env.LANGFLOW_MODEL_PROVIDER || env.AI_PROVIDER : 'ollama';
const FLOW_NAME = 'Orbit Career Agent';

let authHeaders = {};
async function authenticate() {
  if (env.LANGFLOW_API_KEY) {
    authHeaders = { 'x-api-key': env.LANGFLOW_API_KEY };
    return;
  }
  const res = await fetch(`${BASE}/api/v1/auto_login`);
  if (!res.ok) throw new Error(`Langflow auto-login failed (${res.status}). Set LANGFLOW_API_KEY in .env.`);
  const { access_token: token } = await res.json();
  authHeaders = { Authorization: `Bearer ${token}` };
}

async function api(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...authHeaders },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : null;
}

function findTemplate(all, type) {
  // Built-ins are keyed by name; extension components by a namespaced id (ext:<bundle>:<Class>@extra).
  for (const category of Object.values(all)) {
    if (!category || typeof category !== 'object') continue;
    const hit = category[type] ?? Object.values(category).find((c) => c && c.name === type);
    if (hit) return structuredClone(hit);
  }
  throw new Error(`Component "${type}" is not available in Langflow.` + (type === 'OrbitCareerTools' ? ' Is ai/langflow/custom-components mounted (LANGFLOW_COMPONENTS_PATH)? Restart the container.' : ''));
}

const shortId = () => Math.random().toString(36).slice(2, 7);

function makeNode(type, template, position) {
  const id = `${type}-${shortId()}`;
  return { id, type: 'genericNode', position, data: { id, type, node: template, showNode: true } };
}

// Langflow encodes handles as JSON with quotes replaced by "œ".
const encode = (obj, compact) => (compact ? JSON.stringify(obj) : JSON.stringify(obj).replace(/":/g, '": ').replace(/,"/g, ', "')).replace(/"/g, 'œ');

function connect(source, outputName, target, fieldName) {
  const output = source.data.node.outputs.find((o) => o.name === outputName);
  if (!output) throw new Error(`${source.data.type} has no output "${outputName}"`);
  const field = target.data.node.template[fieldName];
  if (!field) throw new Error(`${target.data.type} has no input "${fieldName}"`);
  const sourceHandle = { dataType: source.data.type, id: source.id, name: outputName, output_types: output.types };
  const targetHandle = { fieldName, id: target.id, inputTypes: field.input_types ?? [], type: field.type };
  return {
    id: `reactflow__edge-${source.id}${encode(sourceHandle, true)}-${target.id}${encode(targetHandle, true)}`,
    source: source.id,
    target: target.id,
    sourceHandle: encode(sourceHandle),
    targetHandle: encode(targetHandle),
    data: { sourceHandle, targetHandle },
    animated: false,
    className: '',
    selected: false,
  };
}

function systemPrompt() {
  const md = readFileSync(resolve(root, 'ai/langflow/prompts/orbit-system-prompt.md'), 'utf8');
  return md.replace(/<!--[\s\S]*?-->/, '').trim();
}

function setValue(node, field, value) {
  const f = node.data.node.template[field];
  if (!f) throw new Error(`${node.data.type} has no field "${field}"`);
  f.value = value;
  // Dropdowns only render values they know about.
  if (Array.isArray(f.options) && typeof value === 'string' && !f.options.includes(value)) f.options = [value, ...f.options];
  if (f.load_from_db) f.load_from_db = false;
}

/** Store a secret as a Langflow credential variable and point the field at it by name. */
async function setSecret(node, field, variableName, value) {
  if (!value) throw new Error(`${variableName} is empty in .env — it is required for LANGFLOW_MODEL_PROVIDER=${PROVIDER}.`);
  const existing = (await api('GET', '/api/v1/variables/')).find((v) => v.name === variableName);
  if (existing) await api('PATCH', `/api/v1/variables/${existing.id}`, { id: existing.id, name: variableName, value });
  else await api('POST', '/api/v1/variables/', { name: variableName, value, type: 'Credential', default_fields: [] });
  const f = node.data.node.template[field];
  f.value = variableName;
  f.load_from_db = true;
}

/** The Agent's language model, per provider. */
async function modelNode(all) {
  if (PROVIDER === 'groq') {
    // Groq is OpenAI-compatible; this Langflow build ships no dedicated Groq component.
    const node = makeNode('OpenAIModel', findTemplate(all, 'OpenAIModel'), { x: 0, y: -160 });
    setValue(node, 'openai_api_base', 'https://api.groq.com/openai/v1');
    setValue(node, 'model_name', env.LANGFLOW_MODEL || env.GROQ_MODEL || 'llama-3.3-70b-versatile');
    setValue(node, 'temperature', 0.2);
    await setSecret(node, 'api_key', 'ORBIT_GROQ_API_KEY', env.GROQ_API_KEY);
    return node;
  }
  if (PROVIDER === 'watsonx') {
    const node = makeNode('IBMwatsonxModel', findTemplate(all, 'IBMwatsonxModel'), { x: 0, y: -160 });
    setValue(node, 'base_url', env.WATSONX_URL || 'https://us-south.ml.cloud.ibm.com');
    setValue(node, 'project_id', env.WATSONX_PROJECT_ID || '');
    setValue(node, 'model_name', env.LANGFLOW_MODEL || env.WATSONX_MODEL || 'ibm/granite-3-8b-instruct');
    await setSecret(node, 'api_key', 'ORBIT_WATSONX_API_KEY', env.WATSONX_API_KEY);
    return node;
  }
  const node = makeNode('OllamaModel', findTemplate(all, 'OllamaModel'), { x: 0, y: -160 });
  setValue(node, 'base_url', OLLAMA_URL);
  setValue(node, 'model_name', env.LANGFLOW_MODEL || env.AI_MODEL || 'granite3.3:2b');
  setValue(node, 'temperature', 0.2);
  return node;
}

async function main() {
  await authenticate();
  console.log(`Langflow: ${BASE} · model provider: ${PROVIDER}`);
  const all = await api('GET', '/api/v1/all');

  const chatIn = makeNode('ChatInput', findTemplate(all, 'ChatInput'), { x: 0, y: 260 });
  const tools = makeNode('OrbitCareerTools', findTemplate(all, 'OrbitCareerTools'), { x: 0, y: 560 });
  const model = await modelNode(all);
  const agent = makeNode('Agent', findTemplate(all, 'Agent'), { x: 460, y: 140 });
  const chatOut = makeNode('ChatOutput', findTemplate(all, 'ChatOutput'), { x: 920, y: 300 });

  setValue(agent, 'system_prompt', systemPrompt());
  setValue(agent, 'max_iterations', 6);
  setValue(agent, 'n_messages', 12);
  if (agent.data.node.template.add_calculator_tool) setValue(agent, 'add_calculator_tool', false);
  agent.data.selected_output = 'response';
  model.data.selected_output = 'model_output';

  const nodes = [chatIn, tools, model, agent, chatOut];
  const edges = [
    connect(chatIn, 'message', agent, 'input_value'),
    connect(tools, 'tools', agent, 'tools'),
    connect(model, 'model_output', agent, 'model'),
    connect(agent, 'response', chatOut, 'input_value'),
  ];

  const payload = {
    name: FLOW_NAME,
    description: 'Orbit Career Agent — one orchestrator agent with Orbit career tools. Called by the Orbit API (POST /api/v1/run/{id}).',
    endpoint_name: 'orbit-agent',
    data: { nodes, edges, viewport: { x: 80, y: 120, zoom: 0.8 } },
  };

  let flowId = env.LANGFLOW_FLOW_ID || '';
  if (flowId) {
    try {
      await api('GET', `/api/v1/flows/${flowId}`);
    } catch {
      flowId = '';
    }
  }
  if (!flowId) {
    const existing = await api('GET', '/api/v1/flows/?remove_example_flows=true&header_flows=true').catch(() => []);
    flowId = (Array.isArray(existing) ? existing : []).find((f) => f.name === FLOW_NAME || f.endpoint_name === 'orbit-agent')?.id ?? '';
  }
  const flow = flowId ? await api('PATCH', `/api/v1/flows/${flowId}`, payload) : await api('POST', '/api/v1/flows/', payload);
  console.log(`${flowId ? 'Updated' : 'Created'} flow "${flow.name}" → ${flow.id}`);

  // Export a portable copy for the repository (no user/folder ids).
  const exported = await api('GET', `/api/v1/flows/${flow.id}`);
  const portable = { name: exported.name, description: exported.description, endpoint_name: exported.endpoint_name, data: exported.data, is_component: false };
  writeFileSync(resolve(root, 'ai/langflow/flows/orbit-agent.json'), JSON.stringify(portable, null, 2) + '\n');
  console.log('Exported ai/langflow/flows/orbit-agent.json');

  if (WRITE_ENV) {
    let next = readFileSync(envPath, 'utf8');
    for (const [key, value] of [
      ['LANGFLOW_FLOW_ID', flow.id],
      ['LANGFLOW_MODEL_PROVIDER', PROVIDER],
    ]) {
      const line = new RegExp(`^${key}=.*$`, 'm');
      next = line.test(next) ? next.replace(line, `${key}=${value}`) : `${next.trimEnd()}\n${key}=${value}\n`;
    }
    writeFileSync(envPath, next);
    console.log('Wrote LANGFLOW_FLOW_ID and LANGFLOW_MODEL_PROVIDER to .env — restart the API to pick them up.');
  } else {
    console.log(`Set LANGFLOW_FLOW_ID=${flow.id} in .env (or re-run with --write-env).`);
  }
}

main().catch((error) => {
  console.error(`Langflow setup failed: ${error.message}`);
  process.exit(1);
});
