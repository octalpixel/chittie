// SPIKE: prove the Web Serial adapter implements the Transport contract against
// a mocked navigator.serial (connect requests/opens a port; write goes to the
// writer; bytes arrive intact).
import assert from 'node:assert/strict';
import { createWebSerialTransport, createBridgeTransport, createBestTransport } from '../src/index.js';

const writes: number[][] = [];
let opened = false;
let closed = false;
const writer = {
  async write(d: Uint8Array) {
    writes.push(Array.from(d));
  },
  releaseLock() {},
};
const port = {
  async open() {
    opened = true;
  },
  async close() {
    closed = true;
  },
  writable: { getWriter: () => writer },
};
// install mock navigator.serial (navigator is a getter-only global in Node 22)
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: {
    serial: {
      async getPorts() {
        return [];
      },
      async requestPort() {
        return port;
      },
    },
  },
});

const t = createWebSerialTransport({ baudRate: 19200 });
await t.connect!();
assert.ok(opened, 'port opened on connect');
await t.write(new Uint8Array([0x1b, 0x40, 0x41]));
assert.deepEqual(writes[0], [0x1b, 0x40, 0x41], 'bytes written through the serial writer');
await t.disconnect!();
assert.ok(closed, 'port closed on disconnect');

console.log('✓ chittie-transport-web spike — Web Serial connect/write/disconnect against mock navigator.serial');

// --- bridge transport: POSTs to the print-agent contract (mock fetch) ---
const fetchCalls: Array<{ url: string; init?: { method?: string; headers?: Record<string, string>; body?: string } }> = [];
Object.defineProperty(globalThis, 'fetch', {
  configurable: true,
  value: async (url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => {
    fetchCalls.push({ url: String(url), init });
    return { ok: true, status: 200 } as Response;
  },
});

const bridge = createBridgeTransport({ url: 'http://localhost:8930/', token: 'secret', printer: 'usb' });
await bridge.connect!();
await bridge.write(new Uint8Array([0x1b, 0x40, 0x41]));

assert.ok(fetchCalls[0]!.url.endsWith('/health'), 'connect() pings /health');
assert.ok(fetchCalls[1]!.url.endsWith('/print'), 'write() POSTs /print');
assert.equal(fetchCalls[1]!.init?.method, 'POST');
assert.equal(fetchCalls[1]!.init?.headers?.['x-agent-token'], 'secret', 'token forwarded');
const sent = JSON.parse(fetchCalls[1]!.init!.body!);
assert.deepEqual(sent.bytes, [0x1b, 0x40, 0x41], 'bytes sent as number[]');
assert.equal(sent.printer, 'usb', 'printer forwarded');
console.log('✓ chittie-transport-web spike — bridge transport POSTs bytes to the print-agent /print contract');

// --- createBestTransport: deterministic capability selection (companion > web-serial > error) ---
const upFetch = (async () => ({ ok: true })) as unknown as typeof fetch;
const downFetch = (async () => { throw new Error('refused'); }) as unknown as typeof fetch;
const withSerial = () => Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { serial: { async getPorts() { return []; }, async requestPort() { return port; } } } });
const noSerial = () => Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {} });

withSerial();
assert.equal((await createBestTransport({ fetch: upFetch })).kind, 'companion', 'companion up + default → companion (covers USB/queue/all browsers)');
assert.equal((await createBestTransport({ fetch: downFetch })).kind, 'web-serial', 'companion down + serial → web-serial');
assert.equal((await createBestTransport({ fetch: upFetch, preferCompanion: false })).kind, 'web-serial', 'preferCompanion:false + serial → web-serial');
noSerial();
await assert.rejects(() => createBestTransport({ fetch: downFetch }), /no print transport available/, 'no companion + no serial → clear error');
assert.equal((await createBestTransport({ fetch: upFetch })).kind, 'companion', 'no serial + companion up → companion');
console.log('✓ createBestTransport — capability-detect: companion > web-serial > clear error (not a shotgun)');
