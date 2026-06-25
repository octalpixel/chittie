# RFC: a lightweight React Native package for chittie

Status: **Draft** · Owner: chittie · Supersedes the roadmap "on-device RN rasterizer" item.

## Summary

Build **`@angadie/chittie-native`** — a *narrow* React Native module that supplies the two things
chittie can't do in pure JS on a device: **native text rasterization** (non-Latin → bitmap) and
**read-capable transports** (BLE/USB/TCP). Everything else (ESC/POS & TSPL byte generation) stays
pure TypeScript and already runs on Hermes. Target **dev-client / bare RN, not Expo Go**.

## Context & premise

- chittie's **core is already pure JS** — `chittie-text/react/label` generate bytes and run under
  real Hermes (verified in CI). No native code needed to *author* a receipt or label.
- The two device-only needs are:
  1. **Rasterizing non-Latin text** (Sinhala/Tamil/Arabic) to a bitmap — the differentiator.
  2. **Talking to the printer** — BLE (and now BLE *notify* for status), Android USB host, raw TCP.
- **The premise that settles the design:** BLE/USB require a native module, which requires a
  **custom dev client** — so **Expo Go support is moot**. Once you've left Expo Go for the
  transport, there's no reason to contort the rasterizer to avoid native either. Build a small,
  honest native module instead of a server/Expo-Go fallback.

## Gap analysis — what actually needs native

| Capability | Pure JS today? | Native needed? |
|---|---|---|
| ESC/POS / TSPL byte generation | ✅ `chittie-*` | no |
| `formatMoney`, fold, sanitize, layout | ✅ | no |
| Non-Latin **text → bitmap** | only via heavy `@shopify/react-native-skia` + `captureRef` | **yes (light path)** |
| **Transport** BLE / USB / TCP | needs a native module | **yes** |
| Status read (`DLE EOT`) | needs BLE-notify / USB bulk-in | **yes** (transport `read()` — contract shipped) |

## Options for the rasterizer

- **A. Skia (`react-native-skia`)** — works (`Paragraph` → `Surface` → `readPixels`), but pulls a
  large GPU dependency for what is a tiny "shape one line to a 1-bit bitmap" job.
- **B. Purpose-built Nitro module** — shape text with the platform text engine
  (**CoreText/`UIGraphics`** on iOS, **`android.graphics.Canvas/Paint`** on Android), return the
  pixels as an **ArrayBuffer**. Tiny, no GPU dep, correct shaping + **bidi** for free (both engines
  do Arabic joining and bidi). Implements the existing `TextRasterizer` interface, so it drops into
  `chittie-react`/`chittie-text` with zero core changes.

**Recommendation: B.** It's the chittie differentiator done at the right weight.

## What we reuse / learn from

- **`react-native-nitro-image` (mrousavy)** — a Nitro **pixel container** with zero-copy
  `ArrayBuffer` access (`toRawPixelData`/`loadFromRawPixelData`) over `UIImage`/`CGImage` + Android.
  It is *not* a text shaper. So: **depend on it (or mirror its ArrayBuffer pattern) as the bitmap
  container**, and add only the **shaping** step (CoreText/Paint → write into that buffer). We don't
  reinvent the image type.
- **`react-native-vc-engine` (margelo post)** — the lesson is *build the narrowest native module*:
  a single JS entry point, native format throughout (no RGB round-trip — go straight to a 1-bit/8-bit
  thermal bitmap), platform-specific backends behind one shared contract, heavy work off the JS
  thread. Apply all four to the rasterizer + transport.
- **Flutter thermal packages** (`esc_pos_utils`, `blue_thermal_printer`, `flutter_thermal_printer`):
  the proven shape is **Dart-side byte generation + a platform-channel transport (BLE/USB)**. We
  mirror it exactly: **TS-side byte generation (have it) + a Nitro transport**. Validates the split.

## Proposed architecture

```
@angadie/chittie-native  (dev-client / bare RN; Expo config plugin for prebuild)
├─ rasterizer:  rasterizeText(text, opts) -> { data: ArrayBuffer, width, height }
│   implements TextRasterizer  → drops into chittie-react/text
│   iOS: CoreText/UIGraphics · Android: Canvas/Paint · zero-copy ArrayBuffer · off-thread
│   (bitmap container: reuse react-native-nitro-image's buffer type)
└─ transports (implement Transport, incl. read() for status):
    ├─ BLE   (notify-capable → DLE EOT status)
    ├─ USB   (Android host; bulk-in for status)
    └─ TCP   (raw :9100)
```

- One Nitro entry per capability; minimal JS surface.
- The rasterizer returns a bitmap chittie packs to ESC/POS raster (existing `padTo8` + packer).
- Transports satisfy the contract `chittie-transport` already defines (now with optional `read()`),
  so `print()` and `queryStatus()` work unchanged.

## Phasing

1. **Phase 1 — rasterizer.** The differentiator: print Sinhala/Tamil/Arabic on a device without
   Skia. Implements `TextRasterizer`; verify glyphs via a snapshot on a real device.
2. **Phase 2 — BLE transport + status.** `read()` over BLE notify → `queryStatus()` paper-out/cover.
3. **Phase 3 — USB (Android host) + TCP.** Round out transports.

## Non-goals

- **Expo Go support** — impossible with native BLE/USB; ship a dev-client + Expo config plugin.
- **A generic image library** — `react-native-nitro-image` exists; reuse it, don't rebuild it.
- **GPU pipeline** — thermal bitmaps are tiny; CPU shaping is plenty (unlike vc-engine's real-time video).

## Open questions / risks

- **Nitro maturity / new architecture** — Nitro requires RN new arch. Acceptable (dev-client only),
  but pin versions and document the floor.
- **Maintenance surface** — native code is a cost; keep it *narrow* (the vc-engine lesson) so it's a
  few hundred lines per platform, not a framework.
- **Skia coexistence** — keep the `TextRasterizer` interface so consumers can still choose Skia or
  the server fallback; `chittie-native` is one backend, not a lock-in.

## Decision asked

Approve building `@angadie/chittie-native` as above, **Phase 1 (rasterizer) first**. If yes, next
step is a spike: a Nitro `rasterizeText` returning an ArrayBuffer on iOS (CoreText) wired into
`chittie-react` via the existing interface, snapshot-verified on a device.
