"""Builds the Orbit Career Agent flow inside this Langflow container.

Python port of infra/scripts/langflow-setup.mjs for the Hugging Face Space. The free Space disk
is ephemeral, so this runs on every boot and upserts the flow under a FIXED id
(ORBIT_FLOW_ID) — the Orbit API's LANGFLOW_FLOW_ID never has to change after a restart.

    Chat Input ─▶ Agent (Orbit system prompt) ─▶ Chat Output
                    ▲            ▲
         Language model          Orbit Career Tools (tools → Orbit API on Vercel)

The flow is assembled from the component templates Langflow itself serves (GET /api/v1/all), so
it always matches the running Langflow version. API keys are stored as Langflow credential
variables; the flow only references them by name.
"""

from __future__ import annotations

import copy
import json
import os
import re
import secrets
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent
BASE = f"http://127.0.0.1:{os.getenv('LANGFLOW_PORT', '7860')}"
FLOW_ID = os.getenv("ORBIT_FLOW_ID", "e4ca8987-44ca-452d-9923-5365b5d839d3")
FLOW_NAME = "Orbit Career Agent"
ENDPOINT_NAME = "orbit-agent"
PROVIDER = os.getenv("LANGFLOW_MODEL_PROVIDER", "groq").strip().lower()

_auth: dict[str, str] = {}


def log(msg: str) -> None:
    print(f"[orbit-bootstrap] {msg}", flush=True)


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------
def _send(method: str, path: str, body: Any = None, headers: dict[str, str] | None = None, form: dict | None = None) -> tuple[int, str]:
    if form is not None:
        data = urllib.parse.urlencode(form).encode()
        h = {"Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json"}
    else:
        data = json.dumps(body).encode() if body is not None else None
        h = {"Content-Type": "application/json", "Accept": "application/json"}
    h.update(headers or {})
    req = urllib.request.Request(f"{BASE}{path}", data=data, method=method, headers=h)
    try:
        with urllib.request.urlopen(req, timeout=120) as res:  # noqa: S310 — local Langflow
            return res.status, res.read().decode()
    except urllib.error.HTTPError as err:
        return err.code, err.read().decode(errors="replace")


def api(method: str, path: str, body: Any = None) -> Any:
    status, text = _send(method, path, body, _auth)
    if status >= 400:
        msg = f"{method} {path} → {status}: {text[:400]}"
        raise RuntimeError(msg)
    return json.loads(text) if text else None


def authenticate() -> None:
    """Prefer the env API key (LANGFLOW_API_KEY_SOURCE=env); fall back to a superuser login."""
    global _auth
    api_key = os.getenv("LANGFLOW_API_KEY", "")
    if api_key:
        status, _ = _send("GET", "/api/v1/variables/", headers={"x-api-key": api_key})
        if status < 400:
            _auth = {"x-api-key": api_key}
            return
        log(f"API key auth returned {status}; trying superuser login.")
    username = os.getenv("LANGFLOW_SUPERUSER", "")
    password = os.getenv("LANGFLOW_SUPERUSER_PASSWORD", "")
    if not username or not password:
        msg = "Cannot authenticate: set LANGFLOW_API_KEY or LANGFLOW_SUPERUSER + LANGFLOW_SUPERUSER_PASSWORD."
        raise RuntimeError(msg)
    status, text = _send("POST", "/api/v1/login", form={"username": username, "password": password})
    if status >= 400:
        msg = f"Superuser login failed ({status}): {text[:200]}"
        raise RuntimeError(msg)
    _auth = {"Authorization": f"Bearer {json.loads(text)['access_token']}"}


# ---------------------------------------------------------------------------
# Flow assembly (mirrors langflow-setup.mjs)
# ---------------------------------------------------------------------------
def find_template(all_types: dict, type_name: str) -> dict:
    # Built-ins are keyed by name; extension components by a namespaced id.
    for category in all_types.values():
        if not isinstance(category, dict):
            continue
        hit = category.get(type_name)
        if hit is None:
            hit = next((c for c in category.values() if isinstance(c, dict) and c.get("name") == type_name), None)
        if hit:
            return copy.deepcopy(hit)
    hint = " Is LANGFLOW_COMPONENTS_PATH pointing at orbit/components?" if type_name == "OrbitCareerTools" else ""
    msg = f'Component "{type_name}" is not available in Langflow.{hint}'
    raise RuntimeError(msg)


def short_id() -> str:
    return secrets.token_hex(3)[:5]


def make_node(type_name: str, template: dict, position: dict) -> dict:
    node_id = f"{type_name}-{short_id()}"
    return {"id": node_id, "type": "genericNode", "position": position, "data": {"id": node_id, "type": type_name, "node": template, "showNode": True}}


def encode(obj: dict, *, compact: bool) -> str:
    # Langflow encodes handles as JSON with quotes replaced by "œ".
    text = json.dumps(obj, separators=(",", ":"), ensure_ascii=False)
    if not compact:
        text = text.replace('":', '": ').replace(',"', ', "')
    return text.replace('"', "œ")


def connect(source: dict, output_name: str, target: dict, field_name: str) -> dict:
    output = next((o for o in source["data"]["node"]["outputs"] if o["name"] == output_name), None)
    if output is None:
        msg = f'{source["data"]["type"]} has no output "{output_name}"'
        raise RuntimeError(msg)
    field = target["data"]["node"]["template"].get(field_name)
    if field is None:
        msg = f'{target["data"]["type"]} has no input "{field_name}"'
        raise RuntimeError(msg)
    source_handle = {"dataType": source["data"]["type"], "id": source["id"], "name": output_name, "output_types": output["types"]}
    target_handle = {"fieldName": field_name, "id": target["id"], "inputTypes": field.get("input_types") or [], "type": field.get("type")}
    return {
        "id": f"reactflow__edge-{source['id']}{encode(source_handle, compact=True)}-{target['id']}{encode(target_handle, compact=True)}",
        "source": source["id"],
        "target": target["id"],
        "sourceHandle": encode(source_handle, compact=False),
        "targetHandle": encode(target_handle, compact=False),
        "data": {"sourceHandle": source_handle, "targetHandle": target_handle},
        "animated": False,
        "className": "",
        "selected": False,
    }


def system_prompt() -> str:
    md = (HERE / "prompts" / "orbit-system-prompt.md").read_text(encoding="utf-8")
    return re.sub(r"<!--[\s\S]*?-->", "", md, count=1).strip()


def set_value(node: dict, field: str, value: Any) -> None:
    f = node["data"]["node"]["template"].get(field)
    if f is None:
        msg = f'{node["data"]["type"]} has no field "{field}"'
        raise RuntimeError(msg)
    f["value"] = value
    # Dropdowns only render values they know about.
    if isinstance(f.get("options"), list) and isinstance(value, str) and value not in f["options"]:
        f["options"] = [value, *f["options"]]
    if f.get("load_from_db"):
        f["load_from_db"] = False


def set_secret(node: dict, field: str, variable_name: str) -> None:
    """Store an env secret as a Langflow credential variable and point the field at it by name."""
    value = os.getenv(variable_name, "")
    if not value:
        msg = f"{variable_name} is not set — add it as a Space secret (required for LANGFLOW_MODEL_PROVIDER={PROVIDER})."
        raise RuntimeError(msg)
    existing = next((v for v in api("GET", "/api/v1/variables/") if v.get("name") == variable_name), None)
    if existing:
        api("PATCH", f"/api/v1/variables/{existing['id']}", {"id": existing["id"], "name": variable_name, "value": value})
    else:
        api("POST", "/api/v1/variables/", {"name": variable_name, "value": value, "type": "Credential", "default_fields": []})
    f = node["data"]["node"]["template"][field]
    f["value"] = variable_name
    f["load_from_db"] = True


def model_node(all_types: dict) -> dict:
    position = {"x": 0, "y": -160}
    if PROVIDER == "groq":
        # Groq is OpenAI-compatible; this Langflow build ships no dedicated Groq component.
        node = make_node("OpenAIModel", find_template(all_types, "OpenAIModel"), position)
        set_value(node, "openai_api_base", "https://api.groq.com/openai/v1")
        set_value(node, "model_name", os.getenv("GROQ_MODEL") or "llama-3.3-70b-versatile")
        set_value(node, "temperature", 0.2)
        set_secret(node, "api_key", "ORBIT_GROQ_API_KEY")
        return node
    if PROVIDER == "watsonx":
        node = make_node("IBMwatsonxModel", find_template(all_types, "IBMwatsonxModel"), position)
        set_value(node, "base_url", os.getenv("WATSONX_URL") or "https://us-south.ml.cloud.ibm.com")
        set_value(node, "project_id", os.getenv("WATSONX_PROJECT_ID", ""))
        set_value(node, "model_name", os.getenv("WATSONX_MODEL") or "ibm/granite-3-8b-instruct")
        set_secret(node, "api_key", "ORBIT_WATSONX_API_KEY")
        return node
    msg = f"LANGFLOW_MODEL_PROVIDER must be groq or watsonx on Hugging Face (got {PROVIDER!r}); there is no Ollama here."
    raise RuntimeError(msg)


def build_flow() -> None:
    authenticate()
    log(f"model provider: {PROVIDER} · flow id: {FLOW_ID}")
    all_types = api("GET", "/api/v1/all")

    chat_in = make_node("ChatInput", find_template(all_types, "ChatInput"), {"x": 0, "y": 260})
    tools = make_node("OrbitCareerTools", find_template(all_types, "OrbitCareerTools"), {"x": 0, "y": 560})
    model = model_node(all_types)
    agent = make_node("Agent", find_template(all_types, "Agent"), {"x": 460, "y": 140})
    chat_out = make_node("ChatOutput", find_template(all_types, "ChatOutput"), {"x": 920, "y": 300})

    set_value(agent, "system_prompt", system_prompt())
    set_value(agent, "max_iterations", 6)
    set_value(agent, "n_messages", 12)
    if "add_calculator_tool" in agent["data"]["node"]["template"]:
        set_value(agent, "add_calculator_tool", False)
    agent["data"]["selected_output"] = "response"
    model["data"]["selected_output"] = "model_output"

    payload = {
        "name": FLOW_NAME,
        "description": "Orbit Career Agent — one orchestrator agent with Orbit career tools. Called by the Orbit API (POST /api/v1/run/{id}).",
        "endpoint_name": ENDPOINT_NAME,
        "data": {
            "nodes": [chat_in, tools, model, agent, chat_out],
            "edges": [
                connect(chat_in, "message", agent, "input_value"),
                connect(tools, "tools", agent, "tools"),
                connect(model, "model_output", agent, "model"),
                connect(agent, "response", chat_out, "input_value"),
            ],
            "viewport": {"x": 80, "y": 120, "zoom": 0.8},
        },
    }
    flow = api("PUT", f"/api/v1/flows/{FLOW_ID}", payload)
    log(f'Flow "{flow["name"]}" ready → {flow["id"]} (endpoint: {ENDPOINT_NAME})')

    if not os.getenv("ORBIT_API_URL"):
        log("WARNING: ORBIT_API_URL is not set — Orbit tools cannot reach the API.")
    if not os.getenv("ORBIT_TOOL_API_KEY"):
        log("WARNING: ORBIT_TOOL_API_KEY is not set — Orbit tools will be rejected by the API.")


if __name__ == "__main__":
    build_flow()
