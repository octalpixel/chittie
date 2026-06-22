# @angadie/chittie-transport-node

Network (LAN/Wi-Fi) transport for chittie on **Node / Electron / print-servers**: opens a raw TCP socket to a network printer and streams ESC/POS bytes. **Zero dependencies** (uses `node:net`).

Network printers (Epson TM, Star TSP, most kitchen/counter units) listen on **TCP port 9100** (RAW / JetDirect) — the de-facto standard. This is the same approach as `node-thermal-printer`'s Network interface and the native NetPrinter adapters inside RN printer libraries.

## Install

```bash
pnpm add @angadie/chittie-transport-node @angadie/chittie-transport
```

## Usage

```ts
import { render, Printer, Text, Cut } from '@angadie/chittie';
import { print } from '@angadie/chittie-transport';
import { createNetworkTransport } from '@angadie/chittie-transport-node';

const bytes = render(<Printer width={48}><Text bold>KITCHEN</Text><Cut /></Printer>);

const transport = createNetworkTransport({ host: '192.168.1.50', port: 9100 });
await print(transport, bytes); // connect → write; call transport.disconnect() when done
```

`createNetworkTransport({ host, port = 9100, timeoutMs = 5000 })`.

## Network printing on other platforms

- **React Native (Wi-Fi printers):** Node's `net` isn't available — use [`react-native-tcp-socket`](https://github.com/Rapsssito/react-native-tcp-socket) (its `write` accepts a `Uint8Array` directly) with `createTransport` from [`@angadie/chittie-transport-react-native`](../chittie-transport-react-native):

  ```ts
  import TcpSocket from 'react-native-tcp-socket';
  import { createTransport } from '@angadie/chittie-transport-react-native';

  const socket = TcpSocket.createConnection({ host: '192.168.1.50', port: 9100 }, () => {});
  const transport = createTransport({ write: (b) => { socket.write(Buffer.from(b)); return Promise.resolve(); } });
  ```

- **Browser:** ⚠️ browsers **cannot open raw TCP sockets**, so a web page can't reach `host:9100` directly. Either route through a **backend proxy** (server holds the socket — use this package there), or use the printer's **HTTP API**: Epson **ePOS-Print** (XML over HTTP) or Star **WebPRNT**.

## License

MIT.
