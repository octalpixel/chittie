# @angadie/chittie-transport

The transport contract for chittie, plus helpers. A transport ships ESC/POS bytes to a printer — discovery, permissions, and connection details live in the platform adapter; this package is just the **send contract**. Zero runtime dependencies.

## Install

```bash
pnpm add @angadie/chittie-transport
```

## The contract

```ts
interface Transport {
  connect?(): Promise<void>;   // open the port / connect BLE / open socket
  write(data: Uint8Array): Promise<void>;  // the one required method
  disconnect?(): Promise<void>;
}
```

Implement it directly, or use a ready-made adapter:
[`@angadie/chittie-transport-web`](../chittie-transport-web) ·
[`@angadie/chittie-transport-react-native`](../chittie-transport-react-native).

## Helpers

```ts
import { print, writeBytes, chunk } from '@angadie/chittie-transport';

// connect (if supported) then write:
await print(transport, bytes);

// write in fixed-size chunks (BLE MTU), with an optional inter-chunk delay:
await writeBytes(transport, bytes, { chunkSize: 180, chunkDelayMs: 20 });

// split bytes yourself:
const parts = chunk(bytes, 180); // Uint8Array[]
```

`print` does not disconnect — the caller owns connection lifetime.

## License

MIT.
