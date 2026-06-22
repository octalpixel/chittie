# @angadie/chittie-transport-react-native

Library-agnostic React Native / Expo transport for chittie. **Bring any** BLE (`react-native-ble-plx`), Classic Bluetooth (`react-native-bluetooth-classic`), or TCP (`react-native-tcp-socket`) library — chittie only needs your `write()`. MTU chunking is handled for you.

## Install

```bash
pnpm add @angadie/chittie-transport-react-native @angadie/chittie-transport
```

## Usage — wrap any library

```ts
import { print } from '@angadie/chittie-transport';
import { createTransport } from '@angadie/chittie-transport-react-native';

const transport = createTransport(
  {
    connect: () => device.connect(),
    write: (bytes) => device.write(bytes),   // your library's write
    disconnect: () => device.cancelConnection(),
  },
  { chunkSize: 180, chunkDelayMs: 20 } // optional MTU chunking
);

await print(transport, bytes);
```

## BLE convenience

```ts
import { createBleTransport } from '@angadie/chittie-transport-react-native';

// just pass your characteristic-write; sane BLE chunking defaults are applied
const transport = createBleTransport((bytes) => characteristic.writeWithoutResponse(bytes), {
  connect: () => device.connect(),
});
```

`BLE_DEFAULT_CHUNK` (180) is exported if you need it.

## License

MIT.
