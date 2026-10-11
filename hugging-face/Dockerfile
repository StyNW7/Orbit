# Orbit Career Agent — Langflow on a Hugging Face Docker Space.
# Same Langflow version as infra/docker-compose.yml, so the flow and the Orbit component behave identically.
FROM langflowai/langflow:1.12.5

# Orbit custom component, system prompt and the startup scripts that build the flow.
COPY --chown=1000:0 orbit /app/orbit

# Non-secret configuration. Secrets go in Space Settings → Variables and secrets (see DEPLOYMENT.md).
# - AUTO_LOGIN=false: the UI needs a real login; API calls use LANGFLOW_API_KEY, validated against the env var.
# - The free Space disk is ephemeral: the SQLite DB is rebuilt on every boot and bootstrap.py re-creates
#   the flow under the fixed ORBIT_FLOW_ID, so the Orbit API's LANGFLOW_FLOW_ID never changes.
ENV PYTHONUNBUFFERED=1 \
    LANGFLOW_HOST=0.0.0.0 \
    LANGFLOW_PORT=7860 \
    LANGFLOW_AUTO_LOGIN=false \
    LANGFLOW_API_KEY_SOURCE=env \
    LANGFLOW_SUPERUSER=orbit-admin \
    LANGFLOW_ENABLE_SIGNUP=false \
    LANGFLOW_NEW_USER_IS_ACTIVE=false \
    LANGFLOW_ENABLE_SUPERUSER_CLI=false \
    LANGFLOW_CONFIG_DIR=/app/langflow \
    LANGFLOW_SAVE_DB_IN_CONFIG_DIR=true \
    LANGFLOW_COMPONENTS_PATH=/app/orbit/components \
    LANGFLOW_CREATE_STARTER_PROJECTS=false \
    LANGFLOW_AGENTIC_EXPERIENCE=false \
    LANGFLOW_DO_NOT_TRACK=true \
    LANGFLOW_MODEL_PROVIDER=groq \
    ORBIT_FLOW_ID=e4ca8987-44ca-452d-9923-5365b5d839d3

WORKDIR /app/orbit
EXPOSE 7860
CMD ["python", "start.py"]
