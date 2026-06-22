# chittie — Web example (Web Serial)

Prints a receipt to a USB/serial ESC/POS printer from the browser, with a Sinhala
line auto-rasterized via a `<canvas>` rasterizer.

## Run

```bash
cd examples/web
npx vite            # opens http://localhost:5173
```

Open in **Chrome or Edge desktop** (Web Serial isn't in Safari/Firefox), click
**Print receipt**, and pick your printer's serial port. Subsequent prints reconnect
silently.

## What it shows

- `render(<Printer>…</Printer>)` → `Uint8Array` ([`@angadie/chittie`](../../packages/chittie))
- `createWebSerialTransport()` + `print()` to send the bytes
- `canvasRasterizer()` (see `canvas-rasterizer.ts`) injected via `render(tree, { rasterizer })`
  so the Sinhala line `ආයුබෝවන්!` prints as a bitmap instead of `?`

For BLE printers, swap in `createWebBluetoothTransport({ serviceUuid, characteristicUuid })`
from [`@angadie/chittie-transport-web`](../../packages/chittie-transport-web).
