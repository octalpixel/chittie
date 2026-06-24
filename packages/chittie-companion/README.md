# @angadie/chittie-companion

Client SDK for the **chittie print companion** (the localhost print-agent / Tauri companion
app). Build bytes with `@angadie/chittie` (receipts) or `@angadie/chittie-label` (tags), then
print to a **pinned station** and get back **exactly where it printed** — never a silent
fallback. `fetch`-based, so it runs on web, React Native, and Node 18+.

```bash
npm i @angadie/chittie-companion
```

```ts
import { createCompanionClient } from '@angadie/chittie-companion';

const printer = createCompanionClient({
  url: 'http://localhost:8930',
  token: import.meta.env.VITE_PRINT_TOKEN,
  stations: {                         // pin once (onboarding) — never trust the OS default
    receipt: 'XP-365B',
    kitchen: '192.168.1.51:9100',     // host:port → raw TCP
    bar: '192.168.1.52:9100',
  },
});

if (!(await printer.available())) showSetupHint();          // companion not running
const printers = await printer.printers();                  // for the pin/diagnostics screen

const res = await printer.print(bytes, { station: 'receipt' });
toast(res.printed ? `✓ Printed → ${res.target}` : `✗ ${res.reason}`);
```

> Full integration guide: [MANUAL.md](./MANUAL.md)

## API
- `health()` → `Health | null` (null if unreachable).
- `available()` → `boolean` — use it to choose direct Web Serial vs the companion.
- `printers()` → `PrinterInfo[]` — OS queues + direct-USB devices, for the pin screen.
- `print(bytes, { station } | { target })` → `PrintResult`
  - `{ printed: true, transport, target, bytes }` or `{ printed: false, reason }` — always resolves, never throws.
  - **station** resolves via the `stations` map; a named-but-unconfigured station returns
    `{ printed: false }` **without printing** (no guessing a default — the hard-won POS lesson).
  - **target** is an explicit override: a queue name, `"usb"`, `"host:port"`, or `"virtual"`.

## Notes
- React Native: pass `{ fetch }` if your runtime needs a polyfill.
- Targets the companion's `POST /print-raw` (raw bytes + `x-print-target`); the companion writes
  to the OS queue / USB / TCP and reports the printer name back.
- For the cafe KOT/BOT pattern, configure one station per printer and `print(bytes, { station })`
  per ticket — see the chittie POS vendor guide.
