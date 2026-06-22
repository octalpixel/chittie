# chittie — React Native / Expo example (BLE)

`print.tsx` is the platform-agnostic core: it builds the receipt and prints over a
BLE transport, taking your library's `write` and a `TextRasterizer` as inputs.
Below is how to wire those two on a real device.

## Wiring `write` — react-native-ble-plx

```ts
import { BleManager, type Device } from 'react-native-ble-plx';
import { Buffer } from 'buffer';
import { printReceipt } from './print';

const SERVICE = '0000ff00-0000-1000-8000-00805f9b34fb';
const CHAR = '0000ff02-0000-1000-8000-00805f9b34fb';

async function connectAndPrint(device: Device, rasterizer) {
  await device.connect();
  await device.discoverAllServicesAndCharacteristics();
  const write = (bytes: Uint8Array) =>
    device
      .writeCharacteristicWithoutResponseForService(SERVICE, CHAR, Buffer.from(bytes).toString('base64'))
      .then(() => {});
  await printReceipt(write, rasterizer);
}
```

(chittie doesn't depend on react-native-ble-plx — any BLE/Classic/TCP library works; you
just provide `write`.)

## Wiring `rasterizer` — react-native-skia

A `TextRasterizer` returns `ImageData` (`{ data, width, height }`). With
`@shopify/react-native-skia` you can draw the text to a `Surface`, read pixels via
`makeImageSnapshot().readPixels()`, and wrap them in `ImageData` from
`@canvas/image-data`. Any approach that yields pixels works — even decoding a
server-rendered PNG.

```ts
import ImageData from '@canvas/image-data';
// pixels: Uint8ClampedArray from your Skia snapshot (RGBA)
const rasterizer = {
  rasterize: (text, { fontSize = 28 }) => {
    const { pixels, width, height } = skiaRenderText(text, fontSize); // your impl
    return new ImageData(pixels, width, height);
  },
};
```

## Run

This file is a reference module, not a standalone app. Drop `print.tsx` into your
Expo/RN app, install `@angadie/chittie @angadie/chittie-transport
@angadie/chittie-transport-react-native` + your BLE lib, and call `connectAndPrint`.
