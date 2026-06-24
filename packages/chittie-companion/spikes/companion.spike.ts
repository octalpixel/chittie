// SPIKE: the companion client talks the agent's HTTP contract, resolves stations,
// returns where it printed, and hard-gates an unconfigured station (no silent default).
import assert from 'node:assert/strict';
import { createCompanionClient } from '../src/index.js';

type Recorded = { url: string; init?: RequestInit };
type Reply = { ok: boolean; status: number; body: unknown } | 'throw';

function mockFetch(handler: (url: string, init?: RequestInit) => Reply) {
  const calls: Recorded[] = [];
  const fn = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    const r = handler(url, init);
    if (r === 'throw') throw new Error('network down');
    return { ok: r.ok, status: r.status, json: async () => r.body } as unknown as Response;
  }) as unknown as typeof fetch;
  return { fn, calls };
}

const headersOf = (init?: RequestInit) => (init?.headers ?? {}) as Record<string, string>;

// 1–3. health / available / printers
const m1 = mockFetch((url) => {
  if (url.endsWith('/health')) return { ok: true, status: 200, body: { ok: true, mode: 'print', version: '0.1.0', platform: 'macos' } };
  if (url.endsWith('/printers')) return { ok: true, status: 200, body: { printers: [{ name: 'XP-365B', systemName: 'XP-365B', isDefault: true }] } };
  return { ok: false, status: 404, body: {} };
});
const c1 = createCompanionClient({ fetch: m1.fn, stations: { receipt: 'XP-365B', kitchen: '192.168.1.51:9100' } });
assert.equal((await c1.health())?.mode, 'print', 'health parsed');
assert.equal(await c1.available(), true, 'available when /health ok');
assert.equal((await c1.printers())[0]?.name, 'XP-365B', 'printers listed');

// 4. print to a configured station → POST /print-raw with resolved target + token + octet-stream
const m2 = mockFetch((url) =>
  url.endsWith('/print-raw')
    ? { ok: true, status: 200, body: { ok: true, transport: 'tcp', printer: '192.168.1.51:9100', bytes: 3 } }
    : { ok: false, status: 404, body: {} },
);
const c2 = createCompanionClient({ fetch: m2.fn, token: 'sek', stations: { kitchen: '192.168.1.51:9100' } });
const r2 = await c2.print(Uint8Array.from([1, 2, 3]), { station: 'kitchen' });
assert.deepEqual(r2, { printed: true, transport: 'tcp', target: '192.168.1.51:9100', bytes: 3 }, 'returns where it printed');
const h2 = headersOf(m2.calls[0]?.init);
assert.equal(m2.calls[0]?.init?.method, 'POST');
assert.equal(h2['x-print-target'], '192.168.1.51:9100', 'station resolved to target header');
assert.equal(h2['x-agent-token'], 'sek', 'token sent');
assert.equal(h2['content-type'], 'application/octet-stream', 'raw body');

// 5. unconfigured station → hard-gate: result fail, NO fetch made (never guesses a default)
const m3 = mockFetch(() => ({ ok: true, status: 200, body: { ok: true } }));
const c3 = createCompanionClient({ fetch: m3.fn, stations: {} });
const r3 = await c3.print(Uint8Array.from([1]), { station: 'kitchen' });
assert.equal(r3.printed, false, 'unconfigured station does not print');
assert.match((r3 as { printed: false; reason: string }).reason, /station "kitchen"/, 'clear reason');
assert.equal(m3.calls.length, 0, 'no fetch when station unresolved');

// 6. server-side failure → surfaced as a reason (not thrown)
const m4 = mockFetch(() => ({ ok: false, status: 500, body: { ok: false, error: "printer 'X' not found" } }));
const r4 = await createCompanionClient({ fetch: m4.fn }).print(Uint8Array.from([1]), { target: 'X' });
assert.equal(r4.printed, false);
assert.match((r4 as { printed: false; reason: string }).reason, /not found/, 'server error surfaced');

// 7. network failure → printed:false, available:false (never throws)
const m5 = mockFetch(() => 'throw');
const c5 = createCompanionClient({ fetch: m5.fn });
assert.equal((await c5.print(Uint8Array.from([1]), { target: 'X' })).printed, false, 'network error → printed:false');
assert.equal(await c5.available(), false, 'unreachable → available:false');

console.log('✓ chittie-companion spike — health/available/printers ✓ print-to-station ✓ hard-gate ✓ error+network surfaced ✓');
