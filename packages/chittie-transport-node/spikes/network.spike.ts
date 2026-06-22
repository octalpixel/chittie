// SPIKE: createNetworkTransport over a REAL TCP loopback. A node:net server
// stands in for a :9100 printer; we connect, print, and assert it received the
// exact ESC/POS bytes.
import assert from 'node:assert/strict';
import { createServer, type AddressInfo } from 'node:net';
import { print } from '@angadie/chittie-transport';
import { createNetworkTransport } from '../src/index.js';

const received: number[] = [];
const server = createServer((sock) => {
  sock.on('data', (d) => {
    for (const b of d) received.push(b);
  });
});
await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
const { port } = server.address() as AddressInfo;

const transport = createNetworkTransport({ host: '127.0.0.1', port });
await print(transport, new Uint8Array([0x1b, 0x40, 0x48, 0x69, 0x0a])); // ESC @ "Hi" LF
await transport.disconnect?.();
await new Promise<void>((resolve) => setTimeout(resolve, 50)); // let the server flush
server.close();

assert.deepEqual(received, [0x1b, 0x40, 0x48, 0x69, 0x0a], 'printer received the exact bytes over TCP');
console.log(`✓ chittie-transport-node spike — sent ${received.length} bytes to a real TCP socket (loopback :${port})`);
