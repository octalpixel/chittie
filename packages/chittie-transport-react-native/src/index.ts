import { type Transport, type WriteOptions, writeBytes } from '@angadie/chittie-transport';

/**
 * What YOU implement, wrapping ANY React-Native printer library — BLE
 * (react-native-ble-plx), Classic Bluetooth (react-native-bluetooth-classic),
 * TCP (react-native-tcp-socket), or a vendor SDK. chittie stays library-agnostic:
 * it only needs your write(); connect/disconnect are optional.
 */
export interface RNAdapter {
  connect?(): Promise<void>;
  write(data: Uint8Array): Promise<void>;
  disconnect?(): Promise<void>;
}

export interface CreateTransportOptions extends WriteOptions {}

/**
 * Wrap an RN adapter into a chittie Transport. Chunking (BLE MTU) is applied
 * here so your adapter's write() can stay a dumb "send these bytes".
 */
export function createTransport(adapter: RNAdapter, options: CreateTransportOptions = {}): Transport {
  const inner: Transport = { write: (d) => adapter.write(d) };
  return {
    connect: adapter.connect ? () => adapter.connect!() : undefined,
    disconnect: adapter.disconnect ? () => adapter.disconnect!() : undefined,
    write: (data) => writeBytes(inner, data, options),
  };
}

/** Conservative BLE default: many BLE printers accept ~180-byte writes. */
export const BLE_DEFAULT_CHUNK = 180;

/**
 * BLE convenience: same as createTransport but with sane MTU-chunking defaults.
 * Pass your library's characteristic-write as `write`.
 */
export function createBleTransport(
  write: RNAdapter['write'],
  options: CreateTransportOptions & { connect?: RNAdapter['connect']; disconnect?: RNAdapter['disconnect'] } = {}
): Transport {
  const { connect, disconnect, ...writeOpts } = options;
  return createTransport(
    { write, connect, disconnect },
    { chunkSize: writeOpts.chunkSize ?? BLE_DEFAULT_CHUNK, chunkDelayMs: writeOpts.chunkDelayMs ?? 20 }
  );
}
