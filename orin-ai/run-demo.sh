#!/usr/bin/env bash
# One-command demo: Redis + API + Next (Docker). Requires Docker and orin-ai/.env
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

if ! command -v docker >/dev/null 2>&1; then
  echo "Install Docker first."
  exit 1
fi

if [[ ! -f .env ]]; then
  echo "Missing orin-ai/.env — copy from .env.example and add keys."
  exit 1
fi

# Pick a free host port for the UI (default 3000; auto-fallback if busy)
pick_frontend_port() {
  local p
  for p in 3000 3001 3002 3003; do
    if ! ss -tln 2>/dev/null | grep -qE ":${p}[[:space:]]"; then
      echo "$p"
      return 0
    fi
  done
  echo ""
}

export FRONTEND_HOST_PORT="${FRONTEND_HOST_PORT:-}"
if [[ -z "${FRONTEND_HOST_PORT}" ]]; then
  FRONTEND_HOST_PORT="$(pick_frontend_port)"
  if [[ -z "${FRONTEND_HOST_PORT}" ]]; then
    echo "Ports 3000–3003 are all in use. Free one or set:  FRONTEND_HOST_PORT=3010 ./run-demo.sh"
    exit 1
  fi
fi

if [[ "${FRONTEND_HOST_PORT}" != "3000" ]]; then
  echo "Note: port 3000 is busy — serving the app on http://localhost:${FRONTEND_HOST_PORT}"
  echo ""
fi

echo "Building and starting stack (first run may take a few minutes)..."
docker compose up --build -d

echo ""
echo "=== Orin demo URLs ==="
echo "  App:    http://localhost:${FRONTEND_HOST_PORT}"
echo "  API:    http://localhost:8000/docs"
echo "  Health: http://localhost:8000/health"
echo ""
echo "Stop everything:"
echo "  cd \"$ROOT\" && docker compose down"
echo ""
