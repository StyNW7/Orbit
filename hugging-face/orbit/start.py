"""Container entrypoint: start Langflow, wait until it is healthy, then build the Orbit flow.

Langflow keeps running even if the bootstrap fails, so the UI and logs stay reachable for debugging.
"""

from __future__ import annotations

import os
import signal
import subprocess
import sys
import time
import urllib.request

import bootstrap

PORT = os.getenv("LANGFLOW_PORT", "7860")
HEALTH_URL = f"http://127.0.0.1:{PORT}/health"
STARTUP_TIMEOUT_S = 900
BOOTSTRAP_ATTEMPTS = 3


def healthy() -> bool:
    try:
        with urllib.request.urlopen(HEALTH_URL, timeout=5) as res:  # noqa: S310 — local Langflow
            return res.status == 200
    except Exception:  # noqa: BLE001
        return False


def main() -> int:
    proc = subprocess.Popen(["langflow", "run", "--host", "0.0.0.0", "--port", PORT])  # noqa: S603, S607

    def forward(signum, _frame):
        proc.send_signal(signum)

    signal.signal(signal.SIGTERM, forward)
    signal.signal(signal.SIGINT, forward)

    deadline = time.monotonic() + STARTUP_TIMEOUT_S
    while not healthy():
        if proc.poll() is not None:
            return proc.returncode
        if time.monotonic() > deadline:
            bootstrap.log("Langflow did not become healthy in time; skipping flow bootstrap.")
            return proc.wait()
        time.sleep(3)

    for attempt in range(1, BOOTSTRAP_ATTEMPTS + 1):
        try:
            bootstrap.build_flow()
            break
        except Exception as err:  # noqa: BLE001
            bootstrap.log(f"bootstrap attempt {attempt}/{BOOTSTRAP_ATTEMPTS} failed: {err}")
            time.sleep(10)

    return proc.wait()


if __name__ == "__main__":
    sys.exit(main())
