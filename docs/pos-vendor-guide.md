# Integrating chittie into your POS — vendor guide

How a POS vendor ships thermal printing to clients with chittie. Worked around the **Xprinter
XP-365B** (80mm USB) — the most common case — with LAN/Bluetooth/iPad variants and the cafe
KOT/BOT scenario. Status tags: **[now]** available on npm today; **[soon]** designed/building
(see `docs/architecture.md`).

---

## 0. The model in one line

**Build bytes in JS (chittie) → send them to a companion that owns the printer → show where it
printed.** You build receipts/tags; the companion handles the OS/printer; the operator pins the
printer once.

## 1. Connection reality (drives the whole setup)

For single-terminal retail, **most printers are USB** — and a USB thermal printer installs as an
**OS print queue** ("XP-365B" / "POS-80"). The reliable way to print raw ESC/POS is **through that
queue** (Windows winspool RAW / mac+linux CUPS) — which the companion does. WebUSB usually *can't*
claim a USB printer (the OS driver owns it), so **for USB, the companion+queue is the primary path.**

| Connection | Where it's common | How chittie targets it |
|---|---|---|
| **USB** | single terminal (XP-365B, Epson TM, MUNBYN) — the 90% case | OS print **queue** → `target: "XP-365B"` |
| **Ethernet/LAN** | multi-printer / kitchen / shared (Epson TM, Star, XP-N160) | raw TCP → `target: "192.168.1.50:9100"` (or a TCP/IP OS queue) |
| **Bluetooth** | mobile / handheld | BLE → native/RN path (`chittie-transport-react-native`); web BT is Chromium-only |
| **iPad / Safari** | — | no hardware APIs (permanent) → companion on a LAN machine, or a native app |

**Regions (US/AUS/UK): no software difference.** Same global hardware (Epson TM-T20/T88, Star
TSP143/654, Xprinter, Bixolon, MUNBYN); only the **power plug/voltage** (PSU auto-handles 120/240V)
and **paper width** (58 vs 80mm) differ. ESC/POS is near-universal (Star defaults to StarPRNT but
supports ESC/POS — chittie has both).

## 2. What you build vs what chittie provides

| You (the POS vendor) | chittie provides |
|---|---|
| Receipt/tag content & layout (your branding) | Components + byte-building **[now]**: `@angadie/chittie`, `@angadie/chittie-label` |
| Which items route to which station (cafe) | Multi-station config + print-by-station **[soon]** |
| Drop in the onboarding/diagnostics screen | The recipe (list → test → pin → save) **[soon]**; preview `renderLabel`/`renderReceipt` **[now]** |
| Tell clients to install the companion | The companion (Tauri app / headless binary) **[soon]**; today: the `print-agent` binary |

## 3. One-time integration (you, once — ships to all clients)

```ts
import { Printer, Text, Row, Line, Cut, render, formatMoney } from '@angadie/chittie';      // [now]
import { createCompanionClient } from '@angadie/chittie-companion';                          // [soon]

const printer = createCompanionClient({ url: 'http://localhost:8930', token });

function receiptBytes(order) {
  return render(
    <Printer width={48}>
      <Text align="center" bold size={{ width: 2, height: 2 }}>{order.shopName}</Text>
      <Line />
      {order.items.map((i, k) => (
        <Row key={k} left={`${i.qty}x ${i.name}`} right={formatMoney(i.total, { currency: 'Rs.', decimals: 0 })} />
      ))}
      <Line />
      <Row left="TOTAL" right={formatMoney(order.total, { currency: 'Rs.', decimals: 0 })} />
      <Cut />
    </Printer>,
  );
}

async function printReceipt(order, settings) {
  const res = await printer.print(receiptBytes(order), { station: 'receipt' }); // pinned target
  toast(res.printed ? `✓ Printed → ${res.target}` : `✗ ${res.reason}`);          // always observable
}
```
Plus: embed the **onboarding/diagnostics screen** (list printers → test → pin per station → save).
*Today, before the SDK lands:* `POST { bytes }` to the `print-agent` directly, or — in a Tauri
desktop wrapper — `invoke("print_escpos", { bytes, target })` (the ordereka path, **[now]**).

## 4. Per-client install (5 steps the client/installer follows) — XP-365B

1. **Connect** the XP-365B by USB, power on, load the 80mm roll.
2. **Install the driver** → it shows as an OS print queue ("XP-365B"). (Mac/Linux: CUPS auto-detects, or add a generic **raw** queue.)
3. **Install the chittie companion** (one-click → auto-start; CORS-locked to your POS origin, loopback, token).
4. **Open the POS → onboarding:** lists printers (companion `/printers` → "XP-365B") → tap **Use this** → **test print** → confirm → pinned + saved.
5. **Done.** Receipts target the pinned XP-365B via the queue — deterministic + observable.

### Variants
- **LAN XP / Epson / Star:** pin `target: "192.168.1.50:9100"` (or add a TCP/IP OS queue and pin it).
- **Bluetooth (mobile):** native/RN app + BLE (`chittie-transport-react-native`); not the desktop-web path.
- **iPad web POS (honest limit):** Safari has no hardware APIs, and the iPad can't run the companion.
  Use a **LAN printer + the companion on any always-on machine/mini-PC on the network**, or ship a
  **native iOS app** (RN). Don't promise a pure-Safari iPad reaching a USB printer.

## 5. Cafe / restaurant — KOT/BOT (multi-station)

One order → counter receipt + kitchen ticket (KOT) + bar ticket (BOT), often on different printers.

**Pin per station once** (onboarding): `{ receipt: "XP-365B", kitchen: "192.168.1.51:9100", bar: "192.168.1.52:9100" }`.

**You route; chittie prints each station:**
```ts
// your menu maps each item to a station: item.station = 'kitchen' | 'bar' | undefined(=receipt)
async function fireOrder(order) {
  const food   = order.items.filter(i => i.station === 'kitchen');
  const drinks = order.items.filter(i => i.station === 'bar');

  if (food.length)   await printer.print(kotBytes(order, food,   'KITCHEN'), { station: 'kitchen' });
  if (drinks.length) await printer.print(kotBytes(order, drinks, 'BAR'),     { station: 'bar' });
  // receipt prints on payment, not order-placed:
  // await printer.print(receiptBytes(order), { station: 'receipt' });
}

// A KOT is just a different template — big font, no prices, table/order#, time:
function kotBytes(order, items, heading) {
  return render(
    <Printer width={48}>
      <Text align="center" bold size={{ width: 2, height: 2 }}>{heading}</Text>
      <Text align="center">{`Table ${order.table} · #${order.number}`}</Text>
      <Line />
      {items.map((i, k) => (
        <Text key={k} bold size={{ width: 1, height: 2 }}>{`${i.qty}  ${i.name}${i.mods?.length ? '  (' + i.mods.join(', ') + ')' : ''}`}</Text>
      ))}
      <Cut />
    </Printer>,
  );
}
```
- **Fire-on-place** for KOT/BOT, **print-on-pay** for the receipt — your workflow; each is just
  "build bytes → print to station X".
- **Reprints / void tickets:** same call, a "REPRINT"/"VOID" heading. Each `print()` returns where
  it went, so a failed kitchen print is visible immediately (not a missing meal).

## 6. Checklist before go-live
- [ ] Each station pinned + test-printed; no reliance on the OS default printer.
- [ ] Every print surfaces `✓ → <printer>` / `✗ <reason>` (especially KOT — a silent kitchen miss = a missing dish).
- [ ] Companion auto-starts and is CORS-locked to your origin; pin survives an app/OS update.
- [ ] Paper width matches the template (58/80mm); barcodes/QR on tags scan with the client's scanner.
- [ ] iPad clients: LAN-printer-+-companion or native app — agreed up front.
