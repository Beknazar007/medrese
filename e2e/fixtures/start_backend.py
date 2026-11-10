"""Starts the backend for e2e tests and video recording on a fresh local SQLite database.

Playwright's webServer and videos/tools/make_video.py run this. DATABASE_URL is always
overridden here, so .env's database (local Postgres, or anything else) is never touched.
"""
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
STAND = ROOT / "e2e" / ".stand"
STAND.mkdir(exist_ok=True)
port = os.environ.get("E2E_BACKEND_PORT", "8765")
frontend_port = os.environ.get("E2E_FRONTEND_PORT", "5175")

env = {
    **os.environ,
    # E2E_DB lets a second stand run beside the first (e.g. exploring while a video records).
    "DATABASE_URL": f"sqlite:///{(STAND / os.environ.get('E2E_DB', 'e2e.db')).as_posix()}",
    "JWT_SECRET_KEY": "e2e-only-secret-not-for-servers",
    "CORS_ORIGINS": f"http://localhost:{frontend_port},http://127.0.0.1:{frontend_port}",
}
subprocess.run([sys.executable, str(ROOT / "e2e" / "fixtures" / "seed.py")], env=env, check=True)
sys.exit(
    subprocess.call(
        [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", port],
        env=env,
        cwd=ROOT / "backend",
    )
)
