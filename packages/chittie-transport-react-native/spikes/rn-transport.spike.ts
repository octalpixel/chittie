// SPIKE: prove the library-agnostic RN transport — a user-supplied write()
// (any BLE/Classic/TCP lib) gets wrapped + MTU-chunked, connect/disconnect
// forwarded. No RN/Bluetooth library is imported.
import assert from 'node:assert/strict';
import { createTransport, createBleTransport, BLE_DEFAULT_CHUNK } from '../src/index.js';

const big = new Uint8Array(400).map((_, i) => i % 256);
const writes: number[][] = [];
let connected = false;

const t = createTransport(
  {
    async connect() {
      connected = true;
    },
    async write(d) {
      writes.push(Array.from(d));
    },
  },
  { chunkSize: 180 }
);

await t.connect!();
await t.write(big);

assert.ok(connected, 'connect forwarded to adapter');
assert.equal(writes.length, Math.ceil(400 / 180), 'chunked at 180');
assert.deepEqual(writes.flat(), Array.from(big), 'all bytes delivered, in order');

// BLE preset applies default chunking
const bleWrites: number[][] = [];
const ble = createBleTransport(async (d) => {
  bleWrites.push(Array.from(d));
});
await ble.write(new Uint8Array(500));
assert.equal(bleWrites.length, Math.ceil(500 / BLE_DEFAULT_CHUNK), 'BLE default chunk applied');

console.log('✓ chittie-transport-react-native spike — generic adapter + BLE chunking, library-agnostic');
