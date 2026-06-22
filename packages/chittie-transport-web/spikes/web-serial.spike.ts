// SPIKE: prove the Web Serial adapter implements the Transport contract against
// a mocked navigator.serial (connect requests/opens a port; write goes to the
// writer; bytes arrive intact).
import assert from 'node:assert/strict';
import { createWebSerialTransport } from '../src/index.js';

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
