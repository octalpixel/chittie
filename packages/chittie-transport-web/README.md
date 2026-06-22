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

## WebUSB

```ts
import { createWebUsbTransport } from '@angadie/chittie-transport-web';

const transport = createWebUsbTransport({ filters: [{ vendorId: 0x0416 }] });
```

Claims the device's first interface and writes to its first OUT endpoint. Some printers need a specific interface/endpoint — open an issue if yours differs.

## License

MIT.
