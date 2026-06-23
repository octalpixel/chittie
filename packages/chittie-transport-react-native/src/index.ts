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

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * Encode bytes to base64 — pure JS, no Buffer/btoa (RN-safe). Use for libraries
 * whose write takes a base64 string: react-native-ble-plx, react-native-bluetooth-classic,
 * Sunmi/iMin `sendRAWData`.
 */
export function toBase64(data: Uint8Array): string {
  let out = '';
  for (let i = 0; i < data.length; i += 3) {
    const b0 = data[i]!;
    const b1 = data[i + 1];
    const b2 = data[i + 2];
    const triple = (b0 << 16) | ((b1 ?? 0) << 8) | (b2 ?? 0);
    out +=
      B64.charAt((triple >> 18) & 63) +
      B64.charAt((triple >> 12) & 63) +
      (b1 === undefined ? '=' : B64.charAt((triple >> 6) & 63)) +
      (b2 === undefined ? '=' : B64.charAt(triple & 63));
  }
  return out;
}

/** Bytes to a plain integer array — for libraries whose write takes number[]: react-native-ble-manager, iMin `sendRAWData`. */
export const toByteArray = (data: Uint8Array): number[] => Array.from(data);

/** Bytes to a lowercase hex string — for libraries whose write takes hex: iMin `sendRAWDataHexStr`, Classic-BT hex encoding. */
export const toHex = (data: Uint8Array): string => Array.from(data, (b) => b.toString(16).padStart(2, '0')).join('');

/** Conservative chunking for cheap BLE printers that overrun at larger writes. */
export const BLE_CONSERVATIVE: CreateTransportOptions = { chunkSize: 128, chunkDelayMs: 50 };

/** A BLE characteristic as exposed by common libraries (ble-plx flags, or a properties bag). */
export interface BleCharacteristicLike {
  uuid: string;
  isWritableWithResponse?: boolean;
  isWritableWithoutResponse?: boolean;
  properties?: { write?: boolean; writeWithoutResponse?: boolean; Write?: boolean; WriteWithoutResponse?: boolean };
}

/**
 * Pick the writable characteristic from a connected device's list — replaces the
 * brute-force "try every characteristic" pattern. Prefers write-without-response
 * (faster for print streams). Returns undefined if none is writable.
 */
export function findWritableCharacteristic<T extends BleCharacteristicLike>(characteristics: T[]): T | undefined {
  const writable = (c: T) =>
    c.isWritableWithoutResponse || c.isWritableWithResponse || !!c.properties?.writeWithoutResponse || !!c.properties?.write || !!c.properties?.WriteWithoutResponse || !!c.properties?.Write;
  return (
    characteristics.find((c) => c.isWritableWithoutResponse || c.properties?.writeWithoutResponse || c.properties?.WriteWithoutResponse) ??
    characteristics.find(writable)
  );
}

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
