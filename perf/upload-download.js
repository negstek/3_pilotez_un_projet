// Load test of the critical path of DataShare (`npm run perf`, see PERF.md): a logged-in user uploads a file, opens the link, downloads
// the file, then deletes it. Run by k6 against the back directly (no Vite proxy), on the test database.
import http from 'k6/http'
import { check, fail, sleep } from 'k6'

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001'
// "A few MB": a typical shared document. Generated once per virtual user, in memory.
const FILE_SIZE_MB = Number(__ENV.FILE_SIZE_MB || 5)
const FILE_SIZE_BYTES = FILE_SIZE_MB * 1024 * 1024
const content = new Uint8Array(FILE_SIZE_BYTES).fill(0x61).buffer

export const options = {
  // Two levels: a nominal load (5 users at the same time), then four times more, to see how the latency degrades.
  stages: [
    { duration: '20s', target: 5 },
    { duration: '40s', target: 5 },
    { duration: '20s', target: 20 },
    { duration: '40s', target: 20 },
    { duration: '10s', target: 0 },
  ],
  // Objectives set before the run (see PERF.md): the test fails if one of them is missed.
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{name:upload}': ['p(95)<2000'],
    'http_req_duration{name:metadata}': ['p(95)<300'],
    'http_req_duration{name:download}': ['p(95)<1000'],
    'http_req_duration{name:delete}': ['p(95)<300'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
}

/** Run once: creates the account shared by all the virtual users and returns its token. */
export function setup() {
  const credentials = { email: `perf-${Date.now()}@example.com`, password: 'perf-password' }
  const res = http.post(`${BASE_URL}/auth/register`, JSON.stringify(credentials), { headers: { 'Content-Type': 'application/json' } })
  if (res.status !== 201) fail(`registration failed: ${res.status} ${res.body}`)
  return { token: res.json('accessToken') }
}

export default function ({ token }) {
  const auth = { Authorization: `Bearer ${token}` }

  const upload = http.post(
    `${BASE_URL}/files`,
    { file: http.file(content, 'perf.txt', 'text/plain'), expiresInDays: '1' },
    { headers: auth, tags: { name: 'upload' } },
  )
  if (!check(upload, { 'upload: 201': (r) => r.status === 201 })) return
  const { id, downloadUrl } = upload.json()
  const downloadToken = downloadUrl.split('/f/')[1]

  const metadata = http.get(`${BASE_URL}/f/${downloadToken}`, { tags: { name: 'metadata' } })
  check(metadata, { 'metadata: 200': (r) => r.status === 200 })

  // The body is not kept in memory: only its announced size is checked.
  const download = http.post(`${BASE_URL}/f/${downloadToken}/download`, JSON.stringify({}), {
    headers: { 'Content-Type': 'application/json' },
    responseType: 'none',
    tags: { name: 'download' },
  })
  check(download, {
    'download: 200': (r) => r.status === 200,
    'download: full size': (r) => Number(r.headers['Content-Length']) === FILE_SIZE_BYTES,
  })

  // Keeps the disk usage flat during the test, and exercises the deletion (US06).
  const remove = http.del(`${BASE_URL}/files/${id}`, null, { headers: auth, tags: { name: 'delete' } })
  check(remove, { 'delete: 204': (r) => r.status === 204 })

  // Think time of a real user between two shares.
  sleep(1)
}
