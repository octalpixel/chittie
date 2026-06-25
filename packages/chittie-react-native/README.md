# @angadie/chittie-react-native

The **React Native backend for chittie** — a [Nitro](https://nitro.margelo.com) module that
rasterizes **non-Latin text** (Sinhala/Tamil/Arabic) natively (**CoreText** on iOS,
**android.graphics** on Android) and exposes it as chittie's `TextRasterizer`. No Skia.

> **Dev client / bare RN only** — it's a native module, so it can't run in Expo Go. (Your printer
> transport — BLE/USB — needs a dev client anyway, so this costs you nothing extra.) See the RFC:
> `docs/rfc/rn-native.md`.

## Install

```sh
npm i @angadie/chittie-react-native @angadie/chittie react-native-nitro-modules
cd ios && pod install     # iOS
# Android autolinks; rebuild the dev client.
```

The Nitro bindings (`nitrogen/`) are **generated and shipped** — you only re-run `npm run codegen`
if you change the `.nitro.ts` spec. Built with **react-native-builder-bob** (`lib/commonjs|module|
typescript`). Requires React Native's **new architecture**.

## Use

Pass the native rasterizer to `render()` — everything else is the same chittie API:

```tsx
import { render, Printer, Text, Row } from '@angadie/chittie';
import { createNativeRasterizer } from '@angadie/chittie-react-native';

const rasterizer = createNativeRasterizer();

const bytes = render(
  <Printer width={32}>
    <Text align="center" bold>ආයුබෝවන්</Text>
    <Row left="තේ" right="Rs. 250" />
  </Printer>,
  { dotWidth: 384, rasterizer }   // 58mm
);
// send `bytes` over your transport (BLE/USB/TCP)
```

The native side returns an RGBA bitmap sized to the text (dims padded to /8), which chittie packs
to ESC/POS raster unchanged.

## Architecture

```
TS:   createNativeRasterizer()  →  makeRasterizer(native)  →  chittie TextRasterizer
      (src/index.ts)               (src/adapter.ts, pure)     (ImageData → render())
Nitro spec: src/specs/ChittieRasterizer.nitro.ts  (rasterize → RasterBitmap{data,width,height})
Native:  ios/HybridChittieRasterizer.swift   (UIKit/CoreText)
         android/.../HybridChittieRasterizer.kt  (StaticLayout/Canvas)
```

`makeRasterizer` is pure and dependency-free (no Nitro import) so it's unit-testable off-device;
`createNativeRasterizer` wires the real Nitro HybridObject.

## What's verified vs gated

- **Verified (off-device):** `nitro-codegen` runs and the bindings are committed under `nitrogen/`;
  the TS adapter spike (native bitmap → `ImageData` → chittie's `padTo8`, `spikes/adapter.spike.mts`);
  `bob build` (commonjs/module/typescript) + typecheck in the monorepo gate.
- **Gated (needs Xcode/Android Studio + a device):** the native **Swift/Kotlin compile** and an
  on-device snapshot of the rendered glyphs. The iOS/Android build files mirror the proven
  `react-native-nitro-haptics` template; the device build validates them.

## Roadmap (per the RFC)

- Phase 1 — **rasterizer** (this).
- Phase 2 — **read-capable BLE transport** (status via `DLE EOT` notify; see `chittie-transport`'s
  `queryStatus`).
- Phase 3 — **USB (Android host) + TCP** transports.

## Notes

- Complex shaping + bidi come from the platform engines for free (UIKit/StaticLayout), so Arabic
  joins and reorders correctly. For RTL *rows*, also pass `rtl` to `<Row>` (see `docs/i18n.md`).
- For font selection, the native side uses the system font (which has Sinhala/Tamil/Arabic
  fallbacks); custom-font support is a future option.
