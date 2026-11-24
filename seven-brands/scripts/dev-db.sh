#!/usr/bin/env bash
# Starts a local PostgreSQL 16 (Debian/Ubuntu cluster tools) and creates the dev/test databases.
# Idempotent. For Docker instead: docker compose -f infrastructure/docker-compose.yml up -d
set -euo pipefail
pg_ctlcluster 16 main start 2>/dev/null || true
psql_admin() { sudo -u postgres psql -qtAc "$1"; }
[ "$(psql_admin "SELECT 1 FROM pg_roles WHERE rolname='daos'")" = "1" ] || psql_admin "CREATE ROLE daos LOGIN SUPERUSER PASSWORD 'daos_dev_only'"
for db in daos_dev daos_test daos_e2e_test; do
  [ "$(psql_admin "SELECT 1 FROM pg_database WHERE datname='$db'")" = "1" ] || sudo -u postgres createdb -O daos "$db"
done
echo "PostgreSQL ready: daos_dev, daos_test, daos_e2e_test"
