# @angadie/chittie-transport-react-native

Library-agnostic React Native / Expo transport for chittie. **Bring any** BLE, Classic Bluetooth, TCP, or device-built-in printer library — chittie only needs your `write()`. MTU chunking and byte-encoding helpers are provided so wiring any library is a one-liner.

## Install

```bash
pnpm add @angadie/chittie-transport-react-native @angadie/chittie-transport
```

## Choosing a Bluetooth library (the important part)

**iOS supports BLE (GATT) only — not Classic Bluetooth SPP** (without MFi certification). Most cheap thermal printers are Classic-SPP and therefore **Android-only**. For an app that runs on **both iOS and Android, target BLE printers** and use a cross-platform BLE library:

| Library | Platforms | `write` value type | Notes |
|---|---|---|---|
| **react-native-ble-plx** | iOS + Android | **base64 string** | Most popular/maintained. Use `toBase64()`. |
| **react-native-ble-manager** | iOS + Android | **`number[]`** | Library-side chunking via `maxByteSize`. Use `toByteArray()`. |
| react-native-bluetooth-classic | **Android-only** in practice | `Buffer` | Classic SPP; iOS needs MFi. |
| react-native-tcp-socket | iOS + Android | `Uint8Array` directly | Network/Wi-Fi printers (port 9100), not Bluetooth. |

**BLE restrictions to plan for:**
- **MTU / write size.** Default BLE write is ~20 bytes (ATT MTU 23). iOS negotiates a larger MTU automatically; **on Android you must call the library's `requestMTU(512)`** after connecting, or keep `chunkSize` small. `createBleTransport` chunks at **180** by default with a 20 ms inter-chunk delay.
- **Use write-without-response** for print streams — it's markedly faster (printers don't ACK).
- The printer's write **characteristic must support** `WRITE` or `WRITE_WITHOUT_RESPONSE`.
- **Permissions:** iOS needs `NSBluetoothAlwaysUsageDescription`; Android 12+ needs `BLUETOOTH_SCAN` + `BLUETOOTH_CONNECT` runtime permissions.
- **Expo:** these are native modules — you need a **dev/prebuild client** (config plugin), not Expo Go.

## Encoding helpers

`write(data)` hands you a `Uint8Array`. These pure (Buffer-free) helpers convert it to what each library wants:

```ts
import { toBase64, toByteArray } from '@angadie/chittie-transport-react-native';
toBase64(bytes);    // string  → react-native-ble-plx, bluetooth-classic, Sunmi/iMin sendRAWData
toByteArray(bytes); // number[] → react-native-ble-manager
```

## Wiring — react-native-ble-plx (iOS + Android)

```ts
import { print } from '@angadie/chittie-transport';
import { createBleTransport, toBase64 } from '@angadie/chittie-transport-react-native';

await device.requestMTU(512); // Android; iOS is automatic
const transport = createBleTransport(
  (bytes) => manager.writeCharacteristicWithoutResponseForDevice(device.id, SERVICE, CHAR, toBase64(bytes)).then(() => {}),
  { connect: () => device.connect().then(() => {}) }
);
await print(transport, bytes);
```

## Wiring — react-native-ble-manager (iOS + Android)

```ts
import { createBleTransport, toByteArray } from '@angadie/chittie-transport-react-native';

const transport = createBleTransport((bytes) =>
  BleManager.writeWithoutResponse(peripheralId, SERVICE, CHAR, toByteArray(bytes), 512)
);
```

## Other backends

- **Network (Wi-Fi/LAN, both platforms):** `react-native-tcp-socket` — `socket.write(bytes)` takes a `Uint8Array` directly (no helper). Use `createTransport`.
- **Built-in printers (Sunmi, iMin):** see the dedicated section below.
- **Epson via `react-native-esc-pos-printer`:** exposes `addCommand(Uint8Array)` — can serve as a transport for chittie bytes.

## Built-in printers — Sunmi & iMin (Android POS devices)

These print through an on-device **service** (Sunmi AIDL `IWoyouService`, iMin SDK), **not** Bluetooth or network — so there's no scan/connect; you init the device's printer and push bytes. **Android-only.**

**They accept standard ESC/POS via `sendRAWData`** — Sunmi's docs state it "supports ESC/POS instruction sets" (a documented *subset*), and you can send "already prepared ESC/POS commands." So drive the receipt **body** (text, alignment, rules) with chittie:

```ts
// iMin — sendRAWData takes number[]
import { createTransport, toByteArray, toHex } from '@angadie/chittie-transport-react-native';
const transport = createTransport({ write: (b) => PrinterImin.sendRAWData(toByteArray(b)) });
//                      …or the hex sink: write: (b) => PrinterImin.sendRAWDataHexStr(toHex(b))

// Sunmi — wrapper-dependent; common wrappers take a base64 string
const transport = createTransport({ write: (b) => SunmiPrinter.sendRAWData(toBase64(b)) });
```

**Use the device SDK's own methods for cut, QR, and images** — not because the dialect is non-standard, but because:
- **Cut** is a dedicated call (`cutPaper()` / iMin `fullCut`/`partialCut`) and needs a **hardware cutter** — many handhelds have none, so raw `GS V` does nothing.
- **Images** go through the SDK's **Bitmap** API (`printBitmap` / iMin `printSingleBitmap`), not guaranteed via chittie's raster bytes.
- **QR** has a dedicated call (`printQRCode` / `printQrCode`); raw `GS ( k` isn't guaranteed in the subset.

So: chittie builds the text body → `sendRAWData`; call the SDK for the cut, a QR, or a logo bitmap.

## API

```ts
createTransport(adapter: { connect?; write(Uint8Array); disconnect? }, options?): Transport
createBleTransport(write, options?): Transport   // chunkSize 180, chunkDelayMs 20 defaults
toBase64(Uint8Array): string      // ble-plx, bluetooth-classic, Sunmi sendRAWData (wrappers that take base64)
toByteArray(Uint8Array): number[] // ble-manager, iMin sendRAWData
toHex(Uint8Array): string         // iMin sendRAWDataHexStr, Classic-BT hex
BLE_DEFAULT_CHUNK: 180
```

## License

MIT.
