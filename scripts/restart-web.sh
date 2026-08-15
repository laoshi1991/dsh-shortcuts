#!/bin/bash
# One-shot dsh web restarter: wait for the old server (PID $1) to exit and
# the port to free, then boot a fresh `dsh web`. Fully detached (nohup +
# disown by the launcher); survives the death of the old server AND the
# agent session that armed it.
#
# Env overrides:
#   DSH_BIN      — dsh executable to launch (default: first `dsh` on PATH)
#   DSH_WEB_CWD  — working directory for the new server (default: $HOME)
#   DSH_WEB_PORT — port to wait on / bind (default: 3080)
OLD_PID="${1:-}"
PORT="${DSH_WEB_PORT:-3080}"
DSH="${DSH_BIN:-dsh}"
LOG="$HOME/.dsh/web-restart.log"

echo "[restart] armed $(date '+%F %T'); waiting for old PID ${OLD_PID:-<none>} on port ${PORT}" >>"$LOG"

# wait up to 60s for the old process to disappear
if [ -n "$OLD_PID" ]; then
  for _ in $(seq 1 120); do
    kill -0 "$OLD_PID" 2>/dev/null || break
    sleep 0.5
  done
fi

# wait up to 30s for the TCP port to actually free
for _ in $(seq 1 60); do
  lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1 || break
  sleep 0.5
done

echo "[restart] booting $DSH web --port $PORT at $(date '+%F %T')" >>"$LOG"
cd "${DSH_WEB_CWD:-$HOME}" 2>/dev/null || cd "$HOME" || true
exec "$DSH" web --port "$PORT" >>"$LOG" 2>&1
