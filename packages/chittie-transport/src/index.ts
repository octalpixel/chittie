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
  /** Optional: close the connection. */
  disconnect?(): Promise<void>;
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
