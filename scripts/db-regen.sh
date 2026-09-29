#!/usr/bin/env bash
# Local-only helper for the first days of BE-1: rebuild the (never-applied-elsewhere) migration
# set after a schema edit. It keeps the two hand-written custom migrations and regenerates the
# Drizzle one. After a migration has run anywhere but your own database, STOP using this and
# add a new migration instead (WORKFLOW §5).
set -euo pipefail
cd "$(dirname "$0")/.."
tmp="$(mktemp -d)"
cp supabase/migrations/*private_helpers.sql "$tmp/helpers.sql"
cp supabase/migrations/*security_and_functions.sql "$tmp/security.sql"
rm -rf supabase/migrations && mkdir supabase/migrations
npx drizzle-kit generate --custom --name=private_helpers >/dev/null
cp "$tmp/helpers.sql" supabase/migrations/*private_helpers.sql
sleep 1
npx drizzle-kit generate --name=core_schema >/dev/null
sleep 1
npx drizzle-kit generate --custom --name=security_and_functions >/dev/null
cp "$tmp/security.sql" supabase/migrations/*security_and_functions.sql
ls supabase/migrations
