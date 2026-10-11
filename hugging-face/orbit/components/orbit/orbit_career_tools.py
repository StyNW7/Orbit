"""Orbit Career Tools — Langflow custom component.

Exposes Orbit's career tools (profile, gaps, opportunities, journey, progress, reminders, ...)
to the Langflow Agent component as LangChain StructuredTools.

Every tool is a thin HTTP call back into the Orbit NestJS API:

    POST {ORBIT_API_URL}/agent/tools/{tool}
    headers: x-orbit-tool-key: {ORBIT_TOOL_API_KEY}
    body:    {"session_id": <Langflow session id>, "args": {...}}

Orbit sends its conversation id as the Langflow `session_id`, which is how the API resolves the
user — Langflow never sees user credentials. The tool list is read from
`GET /agent/tools/manifest`, so it always matches the API.

WRITE tools never change data directly: the API records a proposed action and the user confirms it
in the Orbit UI (human-in-the-loop).
"""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from typing import Any

from langchain_core.tools import StructuredTool
from pydantic import Field, create_model

from lfx.custom.custom_component.component import Component
from lfx.field_typing import Tool
from lfx.io import IntInput, MessageTextInput, Output, SecretStrInput

JSON_TYPES: dict[str, type] = {
    "string": str,
    "number": float,
    "integer": int,
    "boolean": bool,
    "array": list,
    "object": dict,
}

LEVEL_NOTE = {
    "READ": "Read-only.",
    "SUGGEST": "Creates a suggestion card the user can accept.",
    "WRITE": "Proposes a change; the user must confirm it in Orbit before anything is saved.",
}

MAX_RESULT_CHARS = 6000


class OrbitCareerToolsComponent(Component):
    display_name = "Orbit Career Tools"
    description = "Orbit's career tools (profile, gaps, opportunities, journey, progress, reminders) served by the Orbit API."
    icon = "Orbit"
    name = "OrbitCareerTools"

    inputs = [
        MessageTextInput(
            name="api_url",
            display_name="Orbit API URL",
            info="Base URL of the Orbit API. Leave empty to use the ORBIT_API_URL environment variable.",
            value="",
            advanced=True,
        ),
        SecretStrInput(
            name="tool_key",
            display_name="Orbit Tool Key",
            info="Shared secret for /agent/tools. Leave empty to use the ORBIT_TOOL_API_KEY environment variable.",
            value="",
            required=False,
            advanced=True,
        ),
        MessageTextInput(
            name="session_override",
            display_name="Session ID (testing)",
            info="Only for testing in the Playground: an Orbit conversation id. Normally the flow's session id is used.",
            value="",
            advanced=True,
        ),
        IntInput(name="timeout", display_name="Timeout (s)", value=30, advanced=True),
    ]

    outputs = [Output(display_name="Tools", name="tools", method="build_tools")]

    # ------------------------------------------------------------------
    def _base_url(self) -> str:
        url = (self.api_url or os.getenv("ORBIT_API_URL") or "http://host.docker.internal:4000/api").strip()
        return url.rstrip("/")

    def _key(self) -> str:
        key = self.tool_key or os.getenv("ORBIT_TOOL_API_KEY") or ""
        if not key:
            msg = "Orbit tool key is missing: set ORBIT_TOOL_API_KEY for the Langflow container."
            raise ValueError(msg)
        return key

    def _session_id(self) -> str:
        sid = (self.session_override or "").strip() or (str(self.graph.session_id) if self.graph and self.graph.session_id else "")
        if not sid:
            msg = "No session id: Orbit calls this flow with its conversation id as session_id."
            raise ValueError(msg)
        return sid

    def _request(self, method: str, path: str, body: dict[str, Any] | None = None) -> Any:
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(
            f"{self._base_url()}{path}",
            data=data,
            method=method,
            headers={"Content-Type": "application/json", "Accept": "application/json", "x-orbit-tool-key": self._key()},
        )
        try:
            with urllib.request.urlopen(req, timeout=self.timeout or 30) as res:  # noqa: S310 — URL is operator-configured
                payload = json.loads(res.read().decode() or "{}")
        except urllib.error.HTTPError as err:
            detail = err.read().decode(errors="replace")[:300]
            msg = f"Orbit API {err.code}: {detail}"
            raise RuntimeError(msg) from err
        except urllib.error.URLError as err:
            msg = f"Orbit API unreachable at {self._base_url()}: {err.reason}"
            raise RuntimeError(msg) from err
        if isinstance(payload, dict) and payload.get("success") is False:
            msg = payload.get("error", {}).get("message", "Orbit tool failed")
            raise RuntimeError(msg)
        return payload.get("data") if isinstance(payload, dict) and "data" in payload else payload

    def _make_tool(self, spec: dict[str, Any]) -> StructuredTool:
        name = spec["name"]
        params = spec.get("parameters") or {}
        props: dict[str, Any] = params.get("properties") or {}
        required = set(params.get("required") or [])

        fields: dict[str, Any] = {}
        for key, prop in props.items():
            py_type = JSON_TYPES.get(prop.get("type", "string"), str)
            desc = prop.get("description", "")
            if prop.get("enum"):
                desc = f"{desc} One of: {', '.join(map(str, prop['enum']))}.".strip()
            if key in required:
                fields[key] = (py_type, Field(..., description=desc))
            else:
                fields[key] = (py_type | None, Field(default=None, description=desc))
        args_model = create_model(f"{name}_args", **fields)

        def run(**kwargs: Any) -> str:
            args = {k: v for k, v in kwargs.items() if v is not None}
            try:
                result = self._request("POST", f"/agent/tools/{name}", {"session_id": self._session_id(), "args": args})
            except Exception as err:  # noqa: BLE001 — surface tool errors to the agent instead of crashing the run
                return json.dumps({"error": str(err)})
            text = json.dumps(result, ensure_ascii=False, default=str)
            return text if len(text) <= MAX_RESULT_CHARS else text[:MAX_RESULT_CHARS] + "...(truncated)"

        level = spec.get("level", "READ")
        return StructuredTool.from_function(
            func=run,
            name=name,
            description=f"{spec.get('description', name)} [{level}] {LEVEL_NOTE.get(level, '')}".strip(),
            args_schema=args_model,
        )

    def build_tools(self) -> list[Tool]:
        manifest = self._request("GET", "/agent/tools/manifest")
        tools = [self._make_tool(spec) for spec in manifest]
        self.status = f"{len(tools)} Orbit tools: " + ", ".join(t.name for t in tools)
        return tools
