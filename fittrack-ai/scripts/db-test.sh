#!/usr/bin/env bash
# Runs the database tests (schema, row-level security, partner sharing).
#
#   TEST_DATABASE_URL set   -> use that database as-is (e.g. local Supabase after
#                              `supabase start`, which has already applied migrations)
#   TEST_DATABASE_URL unset -> start a throwaway Postgres cluster, apply the
#                              Supabase stand-in and every migration, run, tear down
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ -n "${TEST_DATABASE_URL:-}" ]]; then
  exec npx jest --selectProjects db --runInBand "$@"
fi

PG_BIN="${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1 || true)}"
if [[ -z "$PG_BIN" || ! -x "$PG_BIN/initdb" ]]; then
  if command -v initdb >/dev/null; then PG_BIN="$(dirname "$(command -v initdb)")"; else
    echo "Postgres not found. Install it, set PG_BIN, or set TEST_DATABASE_URL." >&2; exit 1
  fi
fi

WORK="$(mktemp -d)"
PORT="${PGTEST_PORT:-54329}"
# Postgres refuses to run as root; in that case run the server as the postgres user.
if [[ "$(id -u)" == "0" ]]; then chown postgres "$WORK"; AS=(su postgres -s /bin/bash -c); else AS=(bash -c); fi
cleanup() { "${AS[@]}" "'$PG_BIN/pg_ctl' -D '$WORK/data' -m immediate stop" >/dev/null 2>&1 || true; rm -rf "$WORK"; }
trap cleanup EXIT

"${AS[@]}" "'$PG_BIN/initdb' -D '$WORK/data' -U postgres -A trust >/dev/null"
"${AS[@]}" "'$PG_BIN/pg_ctl' -D '$WORK/data' -o '-p $PORT -k $WORK -c listen_addresses=127.0.0.1' -l '$WORK/log' -w start >/dev/null"

URL="postgresql://postgres@127.0.0.1:$PORT/postgres"
psql "$URL" -q -v ON_ERROR_STOP=1 -f supabase/tests/supabase_shim.sql
for f in supabase/migrations/*.sql; do
  echo "applying $(basename "$f")"
  psql "$URL" -q -v ON_ERROR_STOP=1 -f "$f"
done

TEST_DATABASE_URL="$URL" npx jest --selectProjects db --runInBand "$@"
