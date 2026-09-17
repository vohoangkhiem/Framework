/**
 * k6 smoke scenario for the Demoblaze catalog API.
 *
 *   k6 run performance/k6/api-smoke.js
 *   k6 run -e VUS=20 -e DURATION=2m performance/k6/api-smoke.js
 *
 * `http`, `check`, `sleep` are provided by the k6 runtime (not Node.js modules).
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

const API_BASE_URL = __ENV.API_BASE_URL || 'https://api.demoblaze.com';

export const options = {
  vus: Number(__ENV.VUS || 5),
  duration: __ENV.DURATION || '30s',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1500', 'p(99)<3000'],
  },
};

export default function () {
  const entries = http.get(`${API_BASE_URL}/entries`);
  check(entries, {
    'entries: status 200': response => response.status === 200,
    'entries: has items': response => response.json('Items.length') > 0,
  });

  const byCategory = http.post(`${API_BASE_URL}/bycat`, JSON.stringify({ cat: 'phone' }), {
    headers: { 'Content-Type': 'application/json' },
  });
  check(byCategory, {
    'bycat: status 200': response => response.status === 200,
  });

  const product = http.post(`${API_BASE_URL}/view`, JSON.stringify({ id: '1' }), {
    headers: { 'Content-Type': 'application/json' },
  });
  check(product, {
    'view: status 200': response => response.status === 200,
    'view: correct product': response => response.json('title') === 'Samsung galaxy s6',
  });

  sleep(1);
}
