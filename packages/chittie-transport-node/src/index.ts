import { createConnection, type Socket } from 'node:net';
import type { Transport } from '@angadie/chittie-transport';

export interface NetworkOptions {
  host: string;
  /** RAW/JetDirect port — 9100 is the de-facto standard for ESC/POS network printers. */
  port?: number;
  /** Connection timeout in ms (default 5000). */
  timeoutMs?: number;
}

/**
 * Network (LAN/Wi-Fi) transport for Node / Electron / print-servers: opens a raw
 * TCP socket to a network printer (host:9100) and streams ESC/POS bytes — the
 * same approach as node-thermal-printer's Network interface and the native
 * NetPrinter adapters in RN printer libs. Zero dependencies (uses node:net).
 */
export function createNetworkTransport(options: NetworkOptions): Transport {
  const port = options.port ?? 9100;
  const timeoutMs = options.timeoutMs ?? 5000;
  let socket: Socket | null = null;

  return {
    connect() {
      return new Promise<void>((resolve, reject) => {
        const s = createConnection({ host: options.host, port });
        s.setTimeout(timeoutMs);
        s.once('connect', () => {
          s.setTimeout(0); // disable the idle timeout once connected
          socket = s;
          resolve();
        });
        s.once('timeout', () => {
          s.destroy();
          reject(new Error(`chittie: connection to ${options.host}:${port} timed out after ${timeoutMs}ms`));
        });
        s.once('error', reject);
      });
    },
    write(data) {
      return new Promise<void>((resolve, reject) => {
        if (!socket) {
          reject(new Error('chittie: not connected — call connect() first'));
          return;
        }
        socket.write(Buffer.from(data), (err) => (err ? reject(err) : resolve()));
      });
    },
    disconnect() {
      return new Promise<void>((resolve) => {
        if (!socket) {
          resolve();
          return;
        }
        socket.end(() => {
          socket = null;
          resolve();
        });
      });
    },
  };
}
