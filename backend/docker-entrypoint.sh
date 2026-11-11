#!/bin/sh
set -e

# The app falls back to a well-known JWT secret when none is set (see docs/AUDIT.md, S1).
# A container is how the app reaches a real server, so refuse to start with it there.
if [ -z "$JWT_SECRET_KEY" ] || [ "$JWT_SECRET_KEY" = "change-me-to-a-random-secret" ]; then
  echo "JWT_SECRET_KEY is empty or the default — set a random value in .env" >&2
  echo "  python -c \"import secrets; print(secrets.token_urlsafe(48))\"" >&2
  exit 1
fi

alembic upgrade head
exec "$@"
