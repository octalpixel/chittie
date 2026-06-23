// SPIKE: prove the library-agnostic RN transport — a user-supplied write()
// (any BLE/Classic/TCP lib) gets wrapped + MTU-chunked, connect/disconnect
// forwarded. No RN/Bluetooth library is imported.
import assert from 'node:assert/strict';
import { createTransport, createBleTransport, BLE_DEFAULT_CHUNK, BLE_CONSERVATIVE, toBase64, toByteArray, toHex, findWritableCharacteristic } from '../src/index.js';

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

// encoding helpers — for the cross-platform BLE libs
assert.equal(toBase64(Uint8Array.from([72, 105])), 'SGk=', 'toBase64 ("Hi") — for react-native-ble-plx');
assert.equal(toBase64(Uint8Array.from([0x1b, 0x40, 0x41])), 'G0BB', 'toBase64 (ESC @ A) round-trips raw bytes');
assert.deepEqual(toByteArray(Uint8Array.from([1, 2, 255])), [1, 2, 255], 'toByteArray — for react-native-ble-manager / iMin sendRAWData');
assert.equal(toHex(Uint8Array.from([0x1b, 0x40, 0x0a, 0xff])), '1b400aff', 'toHex — for iMin sendRAWDataHexStr / Classic-BT');

// findWritableCharacteristic — replaces the iOS brute-force
assert.equal(
  findWritableCharacteristic([{ uuid: 'a', isWritableWithResponse: false }, { uuid: 'b', isWritableWithoutResponse: true }])?.uuid,
  'b',
  'prefers write-without-response (ble-plx flags)'
);
assert.equal(
  findWritableCharacteristic([{ uuid: 'x', properties: {} }, { uuid: 'y', properties: { write: true } }])?.uuid,
  'y',
  'finds writable via properties bag (ble-manager)'
);
assert.equal(findWritableCharacteristic([{ uuid: 'z' }]), undefined, 'no writable characteristic → undefined');
assert.equal(BLE_CONSERVATIVE.chunkSize, 128, 'cheap-printer preset');

console.log('✓ chittie-transport-react-native spike — adapter + chunking + base64/byteArray/hex + findWritableCharacteristic + preset');
