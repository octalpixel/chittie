# @angadie/chittie-transport-web

Web transports for chittie: **Web Serial**, **WebUSB**, and **Web Bluetooth**. Browser platform APIs only — no third-party dependencies. Each factory returns a [`Transport`](../chittie-transport).

> Web Serial / WebUSB / Web Bluetooth require a Chromium browser (Chrome/Edge desktop) over HTTPS, and `connect()` must be called from a user gesture (click).

## Install

```bash
pnpm add @angadie/chittie-transport-web @angadie/chittie-transport
```

## Web Serial (most desktop POS printers)

```ts
import { print } from '@angadie/chittie-transport';
import { createWebSerialTransport } from '@angadie/chittie-transport-web';

const transport = createWebSerialTransport({ baudRate: 9600 });
button.onclick = () => print(transport, bytes); // connect() prompts for the port
```

`createWebSerialTransport` reconnects silently to a previously-granted port; otherwise it prompts.

## Web Bluetooth (BLE printers)

You supply the printer's GATT service + characteristic UUIDs:

```ts
import { createWebBluetoothTransport } from '@angadie/chittie-transport-web';

const transport = createWebBluetoothTransport({
  serviceUuid: 0x18f0,
  characteristicUuid: 0x2af1,
  namePrefix: 'Printer',   // optional device filter
  chunkSize: 180,          // BLE write size
});
```

## Bridge (USB / network printers a browser can't reach)

Browsers can't open USB printer-class devices or raw TCP. Run the [`chittie print-agent`](../../tools/print-agent) on the terminal and POST bytes to it:

```ts
import { print } from '@angadie/chittie-transport';
import { createBridgeTransport } from '@angadie/chittie-transport-web';

const transport = createBridgeTransport({ url: 'http://localhost:8930', token: 'secret', printer: 'usb' });
await print(transport, bytes); // connect() pings /health, write() POSTs /print
```

The agent raw-prints to the OS queue (Windows winspool / CUPS) or, in virtual mode, renders a PNG.

## WebUSB

```ts
import { createWebUsbTransport } from '@angadie/chittie-transport-web';

const transport = createWebUsbTransport({ filters: [{ vendorId: 0x0416 }] });
```

Claims the device's first interface and writes to its first OUT endpoint. Some printers need a specific interface/endpoint — open an issue if yours differs.

## License

MIT.
