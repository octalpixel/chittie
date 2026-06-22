# @angadie/chittie

The front door to **chittie** — write a receipt once, print it on web **and** React Native. Batteries-included: the ESC/POS builder engine (`chittie-core`) + the JSX authoring layer (`chittie-react`), from one import.

> Not yet published. Installs are shown for the intended usage.

## Install

```bash
pnpm add @angadie/chittie react
# plus a transport for your platform:
pnpm add @angadie/chittie-transport-web              # web (Web Serial / USB / Bluetooth)
pnpm add @angadie/chittie-transport-react-native     # RN/Expo (bring your own BLE/Classic/TCP)
```

## Usage — JSX authoring

```tsx
import { Printer, Text, Row, Line, Cut, render } from '@angadie/chittie';
import { print } from '@angadie/chittie-transport';
import { createWebSerialTransport } from '@angadie/chittie-transport-web';

const bytes = render(
  <Printer width={48}>
    <Text align="center" bold>Artisan Haus</Text>
    <Line />
    <Row left="Flat White" right="Rs. 850" />
    <Row left="Croissant" right="Rs. 650" />
    <Line />
    <Row left="TOTAL" right="Rs. 1500" />
    <Cut />
  </Printer>
);

await print(createWebSerialTransport(), bytes); // connects, then writes
```

## Usage — builder authoring

Same engine, no JSX:

```ts
import { ReceiptPrinterEncoder } from '@angadie/chittie';

const bytes = new ReceiptPrinterEncoder({ columns: 48 })
  .initialize()
  .align('center').bold(true).line('Artisan Haus').bold(false)
  .rule()
  .table(
    [{ width: 36, align: 'left' }, { width: 12, align: 'right' }],
    [['Flat White', 'Rs. 850']]
  )
  .cut()
  .encode();
```

## Sinhala / Tamil and other complex scripts

Thermal printers have no code page for Indic scripts, so they must be printed as images. chittie does this automatically when you supply a rasterizer — see [`@angadie/chittie-text`](../chittie-text). Without one, chittie **throws a clear error** rather than silently printing `?`.

```tsx
render(receipt, { rasterizer: myCanvasRasterizer });
```

## What's exported

- Everything from [`@angadie/chittie-react`](../chittie-react) — `Printer`, `Text`, `Row`, `Line`, `Br`, `Cut`, `Cashdraw`, `Barcode`, `QRCode`, `render`, and the prop/option types.
- `ReceiptPrinterEncoder` — the builder engine from [`@angadie/chittie-core`](../chittie-core).

## License

MIT.
