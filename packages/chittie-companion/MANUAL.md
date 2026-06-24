# Chittie Companion SDK — integration manual

`@angadie/chittie-companion` is the client your **web/RN/Node POS** uses to print through the
**Chittie Companion** (the localhost print bridge). You build bytes with `@angadie/chittie`
(receipts, ESC/POS) or `@angadie/chittie-label` (tags, TSPL), then `print()` them to a **pinned
station** and get back **exactly where it printed** — never a silent fallback to the wrong printer.

It is `fetch`-based, so the same code runs in a browser, React Native, or Node 18+.

---

## 1. Mental model

```
your POS (browser/RN)                Chittie Companion (localhost:8930)        printer
─────────────────────                ──────────────────────────────────        ───────
build bytes  ──print(bytes,station)──▶  resolve target ─▶ write raw bytes ─────▶ paper
   ▲                                         │
   └──────── PrintResult (printed/where) ◀───┘
```

- The companion runs on the till machine and exposes `http://localhost:8930`.
- Every browser can reach `localhost` (works on Safari/iPad too, where Web Serial/USB don't exist).
- The SDK never guesses a printer. You pin stations once; a print to an unpinned station fails
  loudly instead of printing to the wrong device — the hard-won POS reliability lesson.

---

## 2. Install & create the client

```bash
npm i @angadie/chittie-companion
```

```ts
import { createCompanionClient } from '@angadie/chittie-companion';

export const printer = createCompanionClient({
  url: 'http://localhost:8930',        // default; override only for remote/custom ports
  token: import.meta.env.VITE_PRINT_TOKEN, // optional; matches the companion's PRINT_AGENT_TOKEN
  stations: {                          // pin once at onboarding — never trust the OS default
    receipt: 'XP-365B',                // an OS print-queue name
    label:   'usb',                    // a direct USB printer-class device
    kitchen: '192.168.1.51:9100',      // host:port → raw TCP (network printer)
    bar:     '192.168.1.52:9100',
  },
  // fetch,                            // RN/older Node: pass a fetch polyfill
});
```

Create it **once** and reuse it (module singleton). `stations` is your config — load it from the
POS settings the owner set during onboarding.

---

## 3. The four methods

| Method | Returns | Use it for |
|---|---|---|
| `health()` | `Health \| null` | Detailed status; `null` if unreachable |
| `available()` | `boolean` | "Is the companion running?" — gate setup hints / transport choice |
| `printers()` | `PrinterInfo[]` | Populate the **pin/diagnostics** screen |
| `print(bytes, opts)` | `PrintResult` | Print to a station/target; **always resolves**, never throws |

```ts
interface PrinterInfo { name: string; systemName: string; isDefault: boolean; transport?: string }
type PrintResult =
  | { printed: true; transport: string; target: string; bytes: number }
  | { printed: false; reason: string };
```

---

## 4. The happy path (receipt)

```ts
import { render, /* Printer, Text, Row, ... */ } from '@angadie/chittie';
import { printer } from './printer';

async function printReceipt(order) {
  if (!(await printer.available())) {
    return showSetupHint('Open the Chittie Companion app to print.');
  }
  const bytes = render(<Receipt order={order} />, { dotWidth: 384, rasterizer }); // 58mm
  const res = await printer.print(bytes, { station: 'receipt' });
  toast(res.printed ? `Printed → ${res.target}` : `Couldn't print: ${res.reason}`);
}
```

`print()` **never throws** — branch on `res.printed`. The `reason` string is safe to show a user.

---

## 5. Labels (TSPL) — same SDK, different bytes + station

A label printer speaks TSPL and is a **separate device**. Build TSPL bytes with
`@angadie/chittie-label`, then print to the **label** station. No transport change.

```ts
import { priceTagBytes } from './labels'; // built on @angadie/chittie-label(-react)
const res = await printer.print(priceTagBytes(product), { station: 'label' });
```

---

## 6. Café KOT/BOT — one station per printer

```ts
// kitchen ticket → kitchen printer; bar ticket → bar printer; receipt → front counter
await printer.print(kotBytes(order), { station: 'kitchen' });
await printer.print(botBytes(order), { station: 'bar' });
await printer.print(receiptBytes(order), { station: 'receipt' });
```
Each ticket goes to its pinned device. An unconfigured station returns
`{ printed: false, reason: 'no printer configured for station "kitchen"...' }` — it does **not**
print to a guessed default.

---

## 7. The pin/onboarding screen

```ts
const found = await printer.printers(); // OS queues + direct-USB devices
// render a list; let the owner choose which device backs each station;
// persist { receipt: <systemName|'usb'|'host:port'>, ... } as the stations map.
```
- `transport: 'usb'` → a direct USB printer-class device; use target `'usb'`.
- otherwise → an OS print queue; use its `systemName`.
- network printer → enter `host:port` manually (it won't appear in `printers()`).

---

## 8. `target` (explicit override) vs `station`

- `{ station: 'receipt' }` — resolves via the `stations` map (preferred; declarative).
- `{ target: 'XP-365B' }` — explicit: an OS queue name, `'usb'`, `'host:port'`, or `'virtual'`.
- `'virtual'` renders a PNG instead of printing (the companion's test/dev mode).
- Bare `print(bytes)` with no station/target uses the companion's own default — **discouraged**
  (that's the "wrong printer" footgun); always pass a station.

---

## 9. Choosing transport (companion vs direct web)

```ts
const useCompanion = await printer.available();
// useCompanion ? print via this SDK (USB/queue/TCP, any browser, iPad)
//              : fall back to Web Serial (@angadie/chittie-transport-web) for serial printers
```
For USB printer-class devices (most cheap thermal printers), Web Serial can't see them — the
companion is the path. Use `available()` to decide.

---

## 10. Security (token)

If the companion runs with `PRINT_AGENT_TOKEN`, pass the same value as `token`; the SDK sends it
as `x-agent-token`. Keep it out of source — load from env (`VITE_PRINT_TOKEN` etc.). For a LAN-only
till this is optional; set it if other devices can reach the machine.

---

## 11. React Native / Node

- **React Native:** `fetch` exists, but if your runtime needs a polyfill pass `{ fetch }`.
  Localhost from the device means the companion runs on the *same* device (or use its LAN IP as `url`).
- **Node 18+:** global `fetch` works; for older Node pass `{ fetch }` (e.g. `undici`).

---

## 12. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `available()` is false | Companion app not running | Start the Chittie Companion app on the till |
| `printed: false, reason: no printer configured for station` | Station not pinned | Add it to `stations` (onboarding) |
| `printed: false, reason: HTTP 401` | Token mismatch | Match `token` to the companion's `PRINT_AGENT_TOKEN` |
| Prints but wraps / wrong width | Receipt built for wrong paper | Match `dotWidth` to the printer (58mm=384, 80mm=576) |
| Nothing on `printers()` for a USB printer | Plugged in after launch | The companion auto-detects; or open its Advanced → "Look for printers again" |

---

## 13. Full minimal example

```ts
import { createCompanionClient } from '@angadie/chittie-companion';

const printer = createCompanionClient({
  stations: { receipt: 'XP-365B', label: 'usb' },
});

export async function checkout(order) {
  if (!(await printer.available())) throw new Error('Companion offline');
  const res = await printer.print(buildReceipt(order), { station: 'receipt' });
  if (!res.printed) throw new Error(res.reason);
  return res.target; // the actual printer it hit
}
```
