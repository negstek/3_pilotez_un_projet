#!/bin/sh
# Performance test (`npm run perf`, see PERF.md). Starts a back of its own on port 3001 with the test database (like `npm run e2e`), with
# JSON logs written to perf/results/back.log, samples its memory every second, runs the k6 scenario, then summarizes the server side metrics.
# Needs the PostgreSQL of docker-compose.
set -e

RESULTS=perf/results
K6_IMAGE=grafana/k6:2.3.0
mkdir -p "$RESULTS"
rm -f "$RESULTS"/*

# Process listening on port 3001, found by its port rather than its name: a development back is also a `node dist/main`.
listener() { ss -ltnpH 'sport = :3001' | sed -n 's/.*pid=\([0-9]*\).*/\1/p' | head -n 1; }
[ -z "$(listener)" ] || { echo "perf: port 3001 is already in use (npm run e2e running?)"; exit 1; }

# JSON whatever back/.env says (LOG_FORMAT=pretty in development): the report below parses the request lines.
LOG_FORMAT=json LOG_LEVEL=info npm run --silent start:e2e -w back > "$RESULTS/back.log" 2>&1 &

echo "perf: waiting for the back on port 3001"
for _ in $(seq 60); do
  NODE_PID=$(listener)
  [ -n "$NODE_PID" ] && break
  sleep 1
done
[ -n "$NODE_PID" ] || { echo "perf: the back did not start, see $RESULTS/back.log"; exit 1; }
trap 'kill "$NODE_PID" 2> /dev/null || true' EXIT

# One line per second: time, resident memory of the Node process (RSS, in KB: are the uploads streamed or buffered?) and CPU time it has
# used so far (user + system, in clock ticks of /proc/<pid>/stat: is the single JavaScript thread saturated?).
(while kill -0 "$NODE_PID" 2> /dev/null; do
  echo "$(date +%s),$(ps -o rss= -p "$NODE_PID" | tr -d ' '),$(awk '{print $14 + $15}' "/proc/$NODE_PID/stat")"
  sleep 1
done) > "$RESULTS/process.csv" &

# The k6 exit code is kept: a missed threshold must fail the command, but only after the report.
K6_STATUS=0
# FILE_SIZE_MB (5 by default) is passed on to the scenario when set: `FILE_SIZE_MB=20 npm run perf`.
docker run --rm --network host --user "$(id -u):$(id -g)" -v "$(pwd)/perf:/perf" -e FILE_SIZE_MB \
  -e K6_WEB_DASHBOARD=true -e K6_WEB_DASHBOARD_EXPORT=/perf/results/report.html \
  "$K6_IMAGE" run --summary-export /perf/results/summary.json /perf/upload-download.js || K6_STATUS=$?

node scripts/perf-report.mjs "$RESULTS"
exit "$K6_STATUS"
