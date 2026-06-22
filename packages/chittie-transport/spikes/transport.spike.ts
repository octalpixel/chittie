// SPIKE: prove the transport contract — chunk() splits correctly, writeBytes
// forwards all bytes (chunked), and print() connects then writes.
import assert from 'node:assert/strict';
import { chunk, writeBytes, print, type Transport } from '../src/index.js';

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

console.log('✓ chittie-transport spike — chunk/writeBytes/print all correct');
