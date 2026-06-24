// Client SDK for the chittie print companion (the localhost print-agent / Tauri
// companion app). Build bytes with @angadie/chittie or @angadie/chittie-label,
// then print(bytes, { station }) and get back exactly where it printed — never a
// silent fallback. fetch-based, so it runs on web, React Native, and Node 18+.

export interface PrinterInfo {
  name: string;
  systemName: string;
  isDefault: boolean;
  /** "usb" for a direct USB printer-class device; absent for an OS print queue. */
  transport?: string;
}

export interface Health {
  ok: boolean;
  service?: string;
  version?: string;
  platform?: string;
  /** "print" or "virtual" (renders a PNG instead of printing). */
  mode?: string;
}

export type PrintResult =
  | { printed: true; transport: string; target: string; bytes: number }
  | { printed: false; reason: string };

export interface PrintOptions {
  /** Explicit target: a queue name, "usb", "host:port", or "virtual". */
  target?: string;
  /** A configured station (e.g. "receipt" | "kitchen" | "bar") — resolved to a target. */
  station?: string;
}

export interface CompanionOptions {
  /** Companion base URL. Default http://localhost:8930. */
  url?: string;
  /** Token sent as x-agent-token (matches the companion's PRINT_AGENT_TOKEN). */
  token?: string;
  /** Station → target map: { receipt: "XP-365B", kitchen: "192.168.1.51:9100" }. */
  stations?: Record<string, string>;
  /** Injectable fetch (for React Native polyfills, Node, or tests). Default global fetch. */
  fetch?: typeof fetch;
}

export interface CompanionClient {
  /** GET /health — null if the companion is unreachable. */
  health(): Promise<Health | null>;
  /** True if the companion answers /health (use to choose direct-web vs companion). */
  available(): Promise<boolean>;
  /** GET /printers — OS queues + direct-USB devices. */
  printers(): Promise<PrinterInfo[]>;
  /** Print raw bytes to a pinned station (or explicit target). Always resolves to a result. */
  print(bytes: Uint8Array, opts?: PrintOptions): Promise<PrintResult>;
}

const DEFAULT_URL = 'http://localhost:8930';

export function createCompanionClient(options: CompanionOptions = {}): CompanionClient {
  const base = (options.url ?? DEFAULT_URL).replace(/\/$/, '');
  const doFetch = options.fetch ?? globalThis.fetch;
  const stations = options.stations ?? {};
  const auth: Record<string, string> = options.token ? { 'x-agent-token': options.token } : {};

  if (typeof doFetch !== 'function') {
    throw new Error('chittie-companion: no fetch available — pass { fetch } (React Native / older Node).');
  }

  // station → target. A station that's named but not configured is an error
  // (the v1.0.x lesson: never silently fall back to a guessed default printer).
  const resolveTarget = (opts?: PrintOptions): string | undefined => {
    if (opts?.target) return opts.target;
    if (opts?.station) {
      const t = stations[opts.station];
      if (!t) {
        throw new Error(
          `chittie-companion: no printer configured for station "${opts.station}". Pin it (stations: { ${opts.station}: "<printer>" }).`
        );
      }
      return t;
    }
    return undefined; // bare print → the companion's own default (discouraged; prefer a station)
  };

  const health = async (): Promise<Health | null> => {
    try {
      const res = await doFetch(`${base}/health`, { headers: { ...auth } });
      return res.ok ? ((await res.json()) as Health) : null;
    } catch {
      return null;
    }
  };

  const printers = async (): Promise<PrinterInfo[]> => {
    const res = await doFetch(`${base}/printers`, { headers: { ...auth } });
    if (!res.ok) throw new Error(`chittie-companion: /printers HTTP ${res.status}`);
    const json = (await res.json()) as { printers?: PrinterInfo[] };
    return json.printers ?? [];
  };

  const print = async (bytes: Uint8Array, opts?: PrintOptions): Promise<PrintResult> => {
    let target: string | undefined;
    try {
      target = resolveTarget(opts);
    } catch (e) {
      return { printed: false, reason: (e as Error).message };
    }
    const reqHeaders: Record<string, string> = { 'content-type': 'application/octet-stream', ...auth };
    if (target) reqHeaders['x-print-target'] = target;
    try {
      const res = await doFetch(`${base}/print-raw`, { method: 'POST', headers: reqHeaders, body: bytes as BodyInit });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        transport?: string;
        printer?: string;
        bytes?: number;
        error?: string;
      };
      if (res.ok && json.ok) {
        return { printed: true, transport: json.transport ?? 'print', target: json.printer ?? target ?? '', bytes: json.bytes ?? bytes.length };
      }
      return { printed: false, reason: json.error ?? `HTTP ${res.status}` };
    } catch (e) {
      return { printed: false, reason: (e as Error).message };
    }
  };

  return { health, available: async () => (await health()) !== null, printers, print };
}
