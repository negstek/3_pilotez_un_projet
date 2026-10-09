// Server side view of a performance test (`npm run perf`, see PERF.md), from the files written by scripts/perf.sh: the structured logs of
// the back (one JSON line per request, with its `responseTime`) and the memory samples. k6 measures what the client sees; this measures
// what the server spends, so the two can be compared.
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const dir = process.argv[2] ?? 'perf/results'

// Only the pino lines: the file also holds the output of the build and of the migrations.
const entries = readFileSync(join(dir, 'back.log'), 'utf8')
  .split('\n')
  .filter((line) => line.startsWith('{'))
  .map((line) => JSON.parse(line))

/** Groups the URLs of one route: ids and download tokens (already shortened in the logs) are replaced by a placeholder. */
const route = (req) =>
  `${req.method} ${req.url
    .replace(/\/f\/[^/?]+/, '/f/:token')
    .replace(/\/files\/[0-9a-f-]{36}/, '/files/:id')
    .replace(/\?.*$/, '')}`

const percentile = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)]

const byRoute = new Map()
for (const { req, res, responseTime } of entries.filter((entry) => entry.req && entry.responseTime !== undefined)) {
  const stats = byRoute.get(route(req)) ?? { times: [], statuses: {} }
  stats.times.push(responseTime)
  stats.statuses[res.statusCode] = (stats.statuses[res.statusCode] ?? 0) + 1
  byRoute.set(route(req), stats)
}

const lines = ['## Server side response time (pino logs, ms)', '', '| Route | Requests | Statuses | p50 | p95 | p99 | max |', '|---|---|---|---|---|---|---|']
for (const [name, { times, statuses }] of [...byRoute].sort()) {
  const sorted = times.sort((a, b) => a - b)
  const codes = Object.entries(statuses)
    .map(([code, count]) => `${code}×${count}`)
    .join(' ')
  lines.push(
    `| ${name} | ${sorted.length} | ${codes} | ${percentile(sorted, 50)} | ${percentile(sorted, 95)} | ${percentile(sorted, 99)} | ${sorted.at(-1)} |`,
  )
}

// Business events: the other lines written while handling a request (they carry its id), as opposed to the startup logs.
const events = {}
for (const { msg } of entries.filter((entry) => entry.reqId && entry.responseTime === undefined)) events[msg] = (events[msg] ?? 0) + 1
lines.push('', '## Business events (pino logs)', '', '| Event | Count |', '|---|---|')
for (const [msg, count] of Object.entries(events)) lines.push(`| ${msg} | ${count} |`)

// time (s), RSS (KB), cumulative CPU time (clock ticks, 100 per second on Linux)
const CLOCK_TICKS = 100
const samples = readFileSync(join(dir, 'process.csv'), 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((line) => line.split(',').map(Number))
  .filter(([, kb]) => kb > 0)
const rss = samples.map(([, kb]) => kb / 1024)
if (rss.length > 0) {
  const avg = rss.reduce((sum, mb) => sum + mb, 0) / rss.length
  lines.push(
    '',
    '## Memory of the Node process (RSS, MB)',
    '',
    '| Samples | Start | Average | Max | End |',
    '|---|---|---|---|---|',
    `| ${rss.length} | ${rss[0].toFixed(0)} | ${avg.toFixed(0)} | ${Math.max(...rss).toFixed(0)} | ${rss.at(-1).toFixed(0)} |`,
  )
}

// Timeline in 10 s slices: shows how the latency follows the load steps of the scenario (5 then 20 virtual users).
const SLICE_MS = 10_000
const requests = entries.filter((entry) => entry.req && entry.responseTime !== undefined && entry.req.url !== '/auth/register')
if (requests.length > 0) {
  const start = requests[0].time
  const slices = new Map()
  for (const entry of requests) {
    const index = Math.floor((entry.time - start) / SLICE_MS)
    const slice = slices.get(index) ?? { count: 0, upload: [], download: [] }
    slice.count++
    if (entry.req.method === 'POST' && entry.req.url === '/files') slice.upload.push(entry.responseTime)
    if (entry.req.url.endsWith('/download')) slice.download.push(entry.responseTime)
    slices.set(index, slice)
  }
  const p95 = (times) => (times.length > 0 ? percentile(times.sort((a, b) => a - b), 95) : '-')
  const inSlice = (index) => {
    const from = start / 1000 + (index * SLICE_MS) / 1000
    return samples.filter(([second]) => second >= from && second < from + SLICE_MS / 1000)
  }
  const maxRss = (index) => {
    const values = inSlice(index).map(([, kb]) => kb / 1024)
    return values.length > 0 ? Math.max(...values).toFixed(0) : '-'
  }
  // Share of one core used by the process over the slice: 100 % means the JavaScript thread never waits.
  const cpu = (index) => {
    const slice = inSlice(index)
    if (slice.length < 2) return '-'
    const [first, last] = [slice[0], slice.at(-1)]
    return `${(((last[2] - first[2]) / CLOCK_TICKS / (last[0] - first[0])) * 100).toFixed(0)} %`
  }
  lines.push(
    '',
    '## Timeline (10 s slices)',
    '',
    '| From (s) | Requests/s | Upload p95 (ms) | Download p95 (ms) | CPU | Max RSS (MB) |',
    '|---|---|---|---|---|---|',
  )
  for (const [index, { count, upload, download }] of [...slices].sort(([a], [b]) => a - b)) {
    lines.push(`| ${(index * SLICE_MS) / 1000} | ${(count / (SLICE_MS / 1000)).toFixed(1)} | ${p95(upload)} | ${p95(download)} | ${cpu(index)} | ${maxRss(index)} |`)
  }
}

const report = lines.join('\n') + '\n'
writeFileSync(join(dir, 'server-report.md'), report)
console.log(`\n${report}`)
