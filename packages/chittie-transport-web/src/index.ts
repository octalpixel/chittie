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
  writeValueWithoutResponse?(d: Uint8Array): Promise<void>;
  writeValue(d: Uint8Array): Promise<void>;
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
  transferOut(endpoint: number, data: Uint8Array): Promise<unknown>;
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

/** Print-agent bridge — POST bytes to a localhost agent that drives a USB/queue printer. */
export interface BridgeOptions {
  /** Agent base URL (default `http://localhost:8930`). */
  url?: string;
  /** Shared secret — sent as the `x-agent-token` header if set. */
  token?: string;
  /** Target OS print queue / `usb`; the agent's default if omitted. */
  printer?: string;
}

/**
 * Transport that POSTs ESC/POS bytes to the chittie print-agent (`tools/print-agent`)
 * — the way a browser reaches a USB printer-class device (or any OS queue) that it
 * can't open directly. `connect()` pings `/health`; `write()` POSTs to `/print`.
 */
export function createBridgeTransport(options: BridgeOptions = {}): Transport {
  const base = (options.url ?? 'http://localhost:8930').replace(/\/+$/, '');
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (options.token) headers['x-agent-token'] = options.token;
  return {
    async connect() {
      const res = await fetch(`${base}/health`);
      if (!res.ok) throw new Error(`chittie: print agent not reachable at ${base} (HTTP ${res.status}).`);
    },
    async write(data) {
      const body = JSON.stringify({
        bytes: Array.from(data),
        ...(options.printer ? { printer: options.printer } : {}),
      });
      const res = await fetch(`${base}/print`, { method: 'POST', headers, body });
      if (!res.ok) throw new Error(`chittie: print agent /print failed (HTTP ${res.status}).`);
    },
  };
}

export interface BestTransportOptions {
  /** Companion/agent URL probed for availability (default http://localhost:8930). */
  companionUrl?: string;
  token?: string;
  /** Target queue / "usb" for the companion path. */
  printer?: string;
  baudRate?: number;
  /**
   * Prefer the companion even when Web Serial exists. Default true — the companion
   * covers USB/queue/network on every browser (incl. Safari/iPad), and most USB
   * printers can't be claimed by WebUSB/Serial anyway.
   */
  preferCompanion?: boolean;
  /** Injectable fetch (tests / RN). */
  fetch?: typeof fetch;
}

export interface BestTransport {
  transport: Transport;
  /** Which mechanism was chosen — surface it so the operator knows the path. */
  kind: 'companion' | 'web-serial';
}

/**
 * Choose the transport MECHANISM by capability — deterministic, not a shotgun that
 * "tries everything and uses whatever connects". Precedence: a reachable companion
 * (USB/queue/network, works in every browser) → Web Serial (Chromium + a serial/COM
 * printer) → a clear error. The DEVICE is still pinned by you (`printer`); this only
 * decides how the bytes leave the browser.
 */
export async function createBestTransport(options: BestTransportOptions = {}): Promise<BestTransport> {
  const doFetch = options.fetch ?? globalThis.fetch;
  const url = (options.companionUrl ?? 'http://localhost:8930').replace(/\/+$/, '');
  const preferCompanion = options.preferCompanion ?? true;

  const companionUp = await probeCompanion(url, doFetch);
  const hasSerial = !!nav().serial;
  const companion = (): BestTransport => ({
    kind: 'companion',
    transport: createBridgeTransport({ url, token: options.token, printer: options.printer }),
  });

  if (companionUp && (preferCompanion || !hasSerial)) return companion();
  if (hasSerial) return { kind: 'web-serial', transport: createWebSerialTransport({ baudRate: options.baudRate }) };
  if (companionUp) return companion();
  throw new Error(
    'chittie: no print transport available. Install the chittie companion (works in every browser, including ' +
      'Safari/iPad), or use Chrome/Edge desktop with a serial printer.'
  );
}

async function probeCompanion(url: string, doFetch: typeof fetch): Promise<boolean> {
  if (typeof doFetch !== 'function') return false;
  try {
    const res = await doFetch(`${url}/health`);
    return res.ok;
  } catch {
    return false;
  }
}
