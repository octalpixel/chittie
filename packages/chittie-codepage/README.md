# @angadie/chittie-codepage

Zero-dependency, Buffer-free code-page encoder — maps strings to printer byte values across 76 code pages (cp437, cp858, windows-1252, …). The low-level text-encoding layer under [`@angadie/chittie-core`](../chittie-core).

> **Vendored** from [`NielsLeenheer/CodepageEncoder`](https://github.com/NielsLeenheer/CodepageEncoder) @ `08e53e4` (MIT). Ships ESM source directly (no build step). See [`VENDOR.md`](../../VENDOR.md). You rarely use this directly — it's a building block.

## Install

```bash
pnpm add @angadie/chittie-codepage
```

## Usage

```ts
import CodepageEncoder from '@angadie/chittie-codepage';

CodepageEncoder.encode('Hello', 'cp437');  // Uint8Array [48 65 6c 6c 6f]
CodepageEncoder.encode('é', 'cp858');      // Uint8Array [82]
CodepageEncoder.getEncodings();            // Codepage[] — all 76
CodepageEncoder.supports('cp858');         // boolean
```

Characters absent from the target code page encode to `0x3f` (`?`). Sinhala, Tamil, and other complex scripts have **no** code page here — detect that with [`@angadie/chittie-text`](../chittie-text) and rasterize instead.

## License

MIT — retains the upstream copyright (see `LICENSE`).
