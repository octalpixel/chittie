/**
 * A transport ships ESC/POS bytes to a printer. Deliberately tiny and
 * library-agnostic: discovery/permissions/connection details live in the
 * concrete adapter (web / react-native / node); this is just the send contract.
 */
export interface Transport {
  /** Optional: open the connection (request port, connect BLE, open socket…). */
  connect?(): Promise<void>;
  /** Write raw bytes to the printer. The one required method. */
  write(data: Uint8Array): Promise<void>;
  /**
   * Optional: read bytes back from the printer (USB bulk-in, serial read, BLE
   * notify). Required only for status queries; transports that can't read omit
   * it and `print()` is unaffected. Resolves with whatever arrived within
   * `timeoutMs` (possibly empty).
   */
  read?(timeoutMs: number): Promise<Uint8Array>;
  /** Optional: close the connection. */
  disconnect?(): Promise<void>;
}

/** Decoded ESC/POS real-time status (DLE EOT). `raw` keeps the source bytes. */
export interface PrinterStatus {
  online: boolean;
  coverOpen: boolean;
  paperOut: boolean;
  paperNearEnd: boolean;
  error: boolean;
  raw: { printer?: number; offline?: number; error?: number; paper?: number };
}

/** DLE EOT n — real-time status request (n: 1 printer, 2 offline, 3 error, 4 paper). */
const dleEot = (n: number) => new Uint8Array([0x10, 0x04, n]);

/**
 * Query a printer's real-time status over a read-capable transport. Writes the
 * DLE EOT transmissions and parses the one-byte replies. Throws if the transport
 * can't read. The reply's fixed bits are ignored; only data bits (2,3,5,6) matter.
 */
export async function queryStatus(transport: Transport, timeoutMs = 1500): Promise<PrinterStatus> {
  if (!transport.read) {
    throw new Error(
      'chittie-transport: queryStatus needs a read-capable transport (USB bulk-in / serial read / BLE notify).'
    );
  }
  if (transport.connect) await transport.connect();
  const ask = async (n: number): Promise<number | undefined> => {
    await transport.write(dleEot(n));
    const reply = await transport.read!(timeoutMs);
    return reply.length > 0 ? reply[reply.length - 1] : undefined; // status is the last byte
  };
  const printer = await ask(1);
  const offline = await ask(2);
  const error = await ask(3);
  const paper = await ask(4);
  return {
    online: printer != null ? (printer & 0x08) === 0 : true,
    coverOpen: offline != null ? (offline & 0x04) !== 0 : false,
    paperOut: paper != null ? (paper & 0x60) === 0x60 : false,
    paperNearEnd: paper != null ? (paper & 0x0c) !== 0 : false,
    error: error != null ? (error & 0x48) !== 0 : false,
    raw: { printer, offline, error, paper },
  };
}

/** Split bytes into fixed-size chunks (e.g. for a BLE MTU). */
export function chunk(data: Uint8Array, size: number): Uint8Array[] {
  if (size <= 0) throw new RangeError('chunk size must be > 0');
  const out: Uint8Array[] = [];
  for (let offset = 0; offset < data.length; offset += size) {
    out.push(data.subarray(offset, Math.min(offset + size, data.length)));
  }
  return out;
}

export interface WriteOptions {
  /** If set, write in chunks of this many bytes (BLE/serial buffer limits). */
  chunkSize?: number;
  /** Optional delay (ms) between chunks, for slow links. */
  chunkDelayMs?: number;
}

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Write bytes, optionally chunked with an inter-chunk delay. */
export async function writeBytes(
  transport: Transport,
  data: Uint8Array,
  options: WriteOptions = {}
): Promise<void> {
  if (!options.chunkSize) {
    await transport.write(data);
    return;
  }
  const chunks = chunk(data, options.chunkSize);
  for (let i = 0; i < chunks.length; i++) {
    await transport.write(chunks[i]!);
    if (options.chunkDelayMs && i < chunks.length - 1) await delay(options.chunkDelayMs);
  }
}

/**
 * Convenience: connect (if the transport supports it) then write the bytes.
 * Does not disconnect — the caller owns connection lifetime.
 */
export async function print(
  transport: Transport,
  data: Uint8Array,
  options: WriteOptions = {}
): Promise<void> {
  if (transport.connect) await transport.connect();
  await writeBytes(transport, data, options);
}
