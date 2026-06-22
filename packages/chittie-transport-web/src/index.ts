import { type Transport, chunk } from '@angadie/chittie-transport';

// Minimal local types for the non-standard browser device APIs (not in TS DOM lib).
interface SerialPortLike {
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  readonly writable: { getWriter(): { write(d: Uint8Array): Promise<void>; releaseLock(): void } } | null;
}
interface SerialLike {
  requestPort(): Promise<SerialPortLike>;
  getPorts(): Promise<SerialPortLike[]>;
}
interface BluetoothCharLike {
  writeValueWithoutResponse?(d: BufferSource): Promise<void>;
  writeValue(d: BufferSource): Promise<void>;
}
interface BluetoothDeviceLike {
  gatt?: {
    connect(): Promise<{ getPrimaryService(uuid: string | number): Promise<{ getCharacteristic(uuid: string | number): Promise<BluetoothCharLike> }> }>;
    disconnect(): void;
  };
}
interface BluetoothLike {
  requestDevice(options: { filters?: unknown[]; optionalServices?: (string | number)[]; acceptAllDevices?: boolean }): Promise<BluetoothDeviceLike>;
}
interface UsbEndpointLike { direction: 'in' | 'out'; endpointNumber: number }
interface UsbDeviceLike {
  open(): Promise<void>;
  close(): Promise<void>;
  selectConfiguration(n: number): Promise<void>;
  claimInterface(n: number): Promise<void>;
  transferOut(endpoint: number, data: BufferSource): Promise<unknown>;
  configuration: { interfaces: { interfaceNumber: number; alternate: { endpoints: UsbEndpointLike[] } }[] } | null;
}
interface UsbLike {
  requestDevice(options: { filters: unknown[] }): Promise<UsbDeviceLike>;
}

const nav = () => globalThis.navigator as unknown as { serial?: SerialLike; bluetooth?: BluetoothLike; usb?: UsbLike };

/** Web Serial (Chrome/Edge desktop). Reconnects to a previously-granted port silently. */
export interface WebSerialOptions {
  baudRate?: number;
}
export function createWebSerialTransport(options: WebSerialOptions = {}): Transport {
  let port: SerialPortLike | null = null;
  const baudRate = options.baudRate ?? 9600;
  return {
    async connect() {
      const serial = nav().serial;
      if (!serial) throw new Error('Web Serial is not supported (use Chrome/Edge desktop over HTTPS).');
      const granted = await serial.getPorts();
      port = granted[0] ?? (await serial.requestPort());
      await port.open({ baudRate });
    },
    async write(data) {
      if (!port?.writable) throw new Error('Printer not connected — call connect() first.');
      const writer = port.writable.getWriter();
      try {
        await writer.write(data);
      } finally {
        writer.releaseLock();
      }
    },
    async disconnect() {
      await port?.close();
      port = null;
    },
  };
}

/** Web Bluetooth (GATT). You supply the printer's service + characteristic UUIDs. */
export interface WebBluetoothOptions {
  serviceUuid: string | number;
  characteristicUuid: string | number;
  namePrefix?: string;
  /** BLE write size (default 180). */
  chunkSize?: number;
}
export function createWebBluetoothTransport(options: WebBluetoothOptions): Transport {
  let characteristic: BluetoothCharLike | null = null;
  let device: BluetoothDeviceLike | null = null;
  const chunkSize = options.chunkSize ?? 180;
  return {
    async connect() {
      const bluetooth = nav().bluetooth;
      if (!bluetooth) throw new Error('Web Bluetooth is not supported in this browser.');
      device = await bluetooth.requestDevice({
        filters: options.namePrefix ? [{ namePrefix: options.namePrefix }] : undefined,
        optionalServices: [options.serviceUuid],
        acceptAllDevices: options.namePrefix ? undefined : true,
      });
      const server = await device.gatt!.connect();
      const service = await server.getPrimaryService(options.serviceUuid);
      characteristic = await service.getCharacteristic(options.characteristicUuid);
    },
    async write(data) {
      if (!characteristic) throw new Error('Printer not connected — call connect() first.');
      for (const part of chunk(data, chunkSize)) {
        if (characteristic.writeValueWithoutResponse) await characteristic.writeValueWithoutResponse(part);
        else await characteristic.writeValue(part);
      }
    },
    async disconnect() {
      device?.gatt?.disconnect();
      characteristic = null;
      device = null;
    },
  };
}

/** WebUSB — claims the first interface and writes to its first OUT endpoint. */
export interface WebUsbOptions {
  filters?: unknown[];
}
export function createWebUsbTransport(options: WebUsbOptions = {}): Transport {
  let device: UsbDeviceLike | null = null;
  let endpoint = 1;
  let iface = 0;
  return {
    async connect() {
      const usb = nav().usb;
      if (!usb) throw new Error('WebUSB is not supported in this browser.');
      device = await usb.requestDevice({ filters: options.filters ?? [] });
      await device.open();
      if (device.configuration === null) await device.selectConfiguration(1);
      const intf = device.configuration!.interfaces[0]!;
      iface = intf.interfaceNumber;
      await device.claimInterface(iface);
      const out = intf.alternate.endpoints.find((e) => e.direction === 'out');
      if (!out) throw new Error('No USB OUT endpoint found on this device.');
      endpoint = out.endpointNumber;
    },
    async write(data) {
      if (!device) throw new Error('Printer not connected — call connect() first.');
      await device.transferOut(endpoint, data);
    },
    async disconnect() {
      await device?.close();
      device = null;
    },
  };
}
