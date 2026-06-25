// SPIKE: prove the transport contract — chunk() splits correctly, writeBytes
// forwards all bytes (chunked), and print() connects then writes.
import assert from 'node:assert/strict';
import { chunk, writeBytes, print, queryStatus, type Transport } from '../src/index.js';

// chunk()
const data = new Uint8Array([1, 2, 3, 4, 5, 6, 7]);
const chunks = chunk(data, 3);
assert.equal(chunks.length, 3);
assert.deepEqual(Array.from(chunks[0]!), [1, 2, 3]);
assert.deepEqual(Array.from(chunks[2]!), [7]);
assert.equal(chunks.reduce((n, c) => n + c.length, 0), data.length, 'no bytes lost');

// a mock transport recording lifecycle + bytes
function makeMock() {
  const writes: number[][] = [];
  let connected = false;
  let disconnected = false;
  const t: Transport = {
    async connect() {
      connected = true;
    },
    async write(d) {
      writes.push(Array.from(d));
    },
    async disconnect() {
      disconnected = true;
    },
  };
  return { t, writes, get connected() { return connected; }, get disconnected() { return disconnected; } };
}

// writeBytes chunked
const m1 = makeMock();
await writeBytes(m1.t, data, { chunkSize: 3 });
assert.equal(m1.writes.length, 3, 'wrote 3 chunks');
assert.deepEqual(m1.writes.flat(), Array.from(data), 'reassembles to original');

// print() connects then writes (whole)
const m2 = makeMock();
await print(m2.t, data);
assert.ok(m2.connected, 'connect() called');
assert.equal(m2.writes.length, 1, 'single write when no chunkSize');
assert.deepEqual(m2.writes[0], Array.from(data));
assert.equal(m2.disconnected, false, 'print does not disconnect (caller owns lifetime)');

// queryStatus: a read-capable mock returns a canned DLE EOT reply keyed by the requested n
function statusMock(bytes: { printer?: number; offline?: number; error?: number; paper?: number }): Transport {
  let last = 0;
  return {
    async write(d) { if (d[0] === 0x10 && d[1] === 0x04) last = d[2]!; },
    async read() {
      const b = ({ 1: bytes.printer, 2: bytes.offline, 3: bytes.error, 4: bytes.paper } as Record<number, number | undefined>)[last];
      return b == null ? new Uint8Array() : new Uint8Array([b]);
    },
  };
}
// 0x12 = fixed-bits-only → all data bits clear → healthy
let st = await queryStatus(statusMock({ printer: 0x12, offline: 0x12, error: 0x12, paper: 0x12 }));
assert.ok(st.online && !st.coverOpen && !st.paperOut && !st.error, 'healthy printer reads clear');
assert.ok((await queryStatus(statusMock({ paper: 0x72 }))).paperOut, 'paper-out (bits 5&6) detected'); // 0x12|0x60
assert.ok((await queryStatus(statusMock({ offline: 0x16 }))).coverOpen, 'cover-open (bit 2) detected'); // 0x12|0x04
assert.equal((await queryStatus(statusMock({ printer: 0x1a }))).online, false, 'offline (bit 3) detected'); // 0x12|0x08
await assert.rejects(() => queryStatus({ async write() {} }), /read-capable/, 'no read() → throws');

console.log('✓ chittie-transport spike — chunk/writeBytes/print + queryStatus(DLE EOT) all correct');
