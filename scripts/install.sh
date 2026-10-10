#!/bin/sh
# Installation of the application on a new machine (`sh scripts/install.sh`, or `npm run setup` once npm is there): checks the prerequisites,
# creates the environment files, installs the dependencies, sets up the database (scripts/setup-db.sh) and builds the three packages.
# Safe to run again: existing .env files are never overwritten. See the "Installation" section of the README.
set -e

cd "$(dirname "$0")/.."

# 1. Prerequisites. The Node.js versions are the ones required by Vite 8 and Prisma 7 (see the README).
for tool in node npm docker; do
  command -v "$tool" > /dev/null || { echo "install: $tool is required but was not found"; exit 1; }
done
docker compose version > /dev/null 2>&1 || { echo "install: Docker Compose v2 is required ('docker compose')"; exit 1; }
node -e '
  const [major, minor] = process.versions.node.split(".").map(Number);
  const ok = (major === 20 && minor >= 19) || (major === 22 && minor >= 12) || major > 22;
  if (!ok) { console.error(`install: Node.js 20.19+ or 22.12+ is required, found ${process.versions.node}`); process.exit(1); }
'

# 2. Environment files, copied from their example. An existing file is kept: it may hold a secret or a local setting.
BACK_ENV_CREATED=0
for dir in . back front; do
  if [ -f "$dir/.env" ]; then
    echo "install: $dir/.env already exists, kept as is"
  else
    cp "$dir/.env.example" "$dir/.env"
    echo "install: $dir/.env created from $dir/.env.example"
    [ "$dir" = back ] && BACK_ENV_CREATED=1
  fi
done

# The example ships a placeholder JWT secret, known to anyone who reads the repository: a new back/.env gets a random one (256 bits).
if [ "$BACK_ENV_CREATED" = 1 ]; then
  node -e '
    const fs = require("node:fs");
    const secret = require("node:crypto").randomBytes(32).toString("hex");
    fs.writeFileSync("back/.env", fs.readFileSync("back/.env", "utf8").replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${secret}`));
  '
  echo "install: random JWT_SECRET written to back/.env"
fi

# 3. Dependencies of the three packages, exactly as pinned by the lockfile. The postinstall scripts build shared_lib and generate the
#    Prisma client.
echo "install: installing the dependencies"
npm ci

# 4. Database: PostgreSQL container and migrations.
sh scripts/setup-db.sh

# 5. Build of shared_lib, the back and the front: fails here rather than at the first start if something is wrong.
echo "install: building the application"
npm run build

echo "install: done. Start the application with the commands of the README (section « Lancer le projet en développement »)."
