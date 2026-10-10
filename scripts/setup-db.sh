#!/bin/sh
# Database setup (`npm run db:setup`, also called by scripts/install.sh): starts the PostgreSQL of docker-compose.yml, waits until it accepts
# connections, then applies the Prisma migrations. Safe to run again: a started container is left as is and applied migrations are skipped.
# Needs the dependencies (`npm ci`) and back/.env, whose DATABASE_URL must match the credentials of the root .env.
set -e

cd "$(dirname "$0")/.."

[ -f back/.env ] || { echo "db: back/.env is missing, run 'npm run setup' first (or copy back/.env.example)"; exit 1; }
[ -x node_modules/.bin/prisma ] || { echo "db: dependencies are missing, run 'npm run setup' first (or 'npm ci')"; exit 1; }

# --wait returns once the healthcheck of the service (pg_isready) passes, and fails if it never does.
echo "db: starting PostgreSQL"
docker compose up -d --wait db

# `migrate deploy` only applies the committed migrations: unlike `migrate dev`, it never generates one nor resets the database.
echo "db: applying the migrations"
(cd back && npx prisma migrate deploy)

echo "db: ready"
