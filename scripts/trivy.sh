#!/bin/sh
# Security scan with Trivy (`npm run security:trivy`, also run by the CI): fails on any high or critical finding. Trivy runs in its Docker
# image, pinned to an exact version, so nothing has to be installed. Results and decisions are documented in SECURITY.md.
set -e

TRIVY_IMAGE=aquasec/trivy:0.74.0
# The vulnerability database (~120 MB) is kept in a Docker volume between two runs.
TRIVY="docker run --rm -v trivy-cache:/root/.cache/trivy -v $(pwd):/src:ro -v /var/run/docker.sock:/var/run/docker.sock $TRIVY_IMAGE"
COMMON="--quiet --exit-code 1 --severity HIGH,CRITICAL"

# 1. The repository: vulnerable dependencies of the lockfile (dev ones included: they run on the developers' machines and in the CI),
#    secrets committed by mistake, misconfigurations of the infrastructure files.
echo "trivy: repository (dependencies, secrets, configuration)"
$TRIVY fs $COMMON --scanners vuln,secret,misconfig --include-dev-deps --skip-dirs '**/node_modules' /src

# 2. The Docker images of docker-compose.yml (PostgreSQL). `gosu` is skipped: a Go binary of the official image, only run by its entry
#    point to drop the root privileges at startup, whose Go standard library CVEs (TLS, HTTP, URL parsing) are not reachable. See SECURITY.md.
for image in $(sed -n 's/^ *image: *//p' docker-compose.yml); do
  echo "trivy: image $image"
  docker pull --quiet "$image" > /dev/null
  $TRIVY image $COMMON --skip-files usr/local/bin/gosu "$image"
done
