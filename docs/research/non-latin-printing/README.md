# Printing Sinhala / Tamil (and complex scripts) on thermal printers — decision

## TL;DR
> **There is no credible non-raster path for Sinhala on any thermal printer, and no *correctly-shaped* text path for Tamil either.** Thermal printers are dumb glyph-renderers with no shaping engine; complex scripts need reordering + conjunct ligatures that a 1-byte→1-glyph code page physically cannot express. **Every vendor, OS, and SDK in the world solves this the same way: shape on the host (HarfBuzz/OS text engine) → rasterize → send a bitmap.** So chittie should do exactly that — but make it *automatic, correctly-shaped, mixed Latin/Indic, and never silently `?`*. That automation (not a new byte protocol) is the thing we own.
> **Flip only if** you standardize on an Epson TM‑P80II/P20II *South‑Asia SKU* **and** need only Tamil/Hindi (never Sinhala) **and** can accept unshaped output — a niche that still doesn't help Sinhala.

## The candidates (we hunted hard for non-raster — this is not "image by default")
| Approach | Works for Sinhala/Tamil? | Why / why not | Verdict |
|---|---|---|---|
| **Code page text** (`ESC t` + `codepage-encoder`) | ❌ | No printer code page contains Sinhala; Tamil only on 3 Epson SKUs; all are flat 1:1, **no shaping** → garbled / `?` | Avoid (silent `?`) |
| **User-defined chars** (`ESC &`, `FS 2`, `GS *`) | ❌ | `ESC &` = ASCII 32–126 only (≤95, often ~19 slots), ≤12×24 dots, **1-byte→1-fixed-bitmap, no reorder/ligature**; it's raster-per-glyph with *worse* layout limits | Not viable |
| **Built-in Indic font ROM** | ❌ for Sinhala; ⚠️ broken for Tamil | Only Epson **TM-P20/P20II/P80II South-Asia SKUs** carry code pages 66–75/82 (Tamil/Devanagari/…); **no Sinhala anywhere**; and they **don't shape** → wrong for real words | Niche, still broken |
| **Host-shape → glyph-index → downloaded font** | ⚠️ theoretical | `hb_shape()` does output font-locked glyph IDs (genuinely non-raster), but glyph counts blow past slot limits and mark-positioning offsets have **no ESC/POS command expression**; **no shipping system does this** | Theoretical only |
| **Smart-device firmware shaping** (historical) | ✅ (not thermal) | **C-DAC GIST card/terminal/ASIC** consumed **ISCII** and shaped in *hardware* — proof it *can* be done, but requires a smart renderer; no thermal printer has one | Doesn't exist for thermal |
| **Host-shape → rasterize → `image()`** | ✅ | Platform text engine (HarfBuzz) shapes correctly; printer prints pixels → any script works | **Pick** |

## What the ecosystem actually does (evidence it's universal, not lazy)
- **Sunmi / iMin** Android POS "Tamil support" = Android `Canvas`/`StaticLayout` (HarfBuzz) → `printBitmap`/`sendViewToPrinter`. iMin's text API literally documents *"(not support Arabic)"*. Their text path can't shape; the bitmap path can.
- **Star**: `appendBitmap` "converts the text into a bitmap image and sends it to the printer."
- **Windows GDI graphics mode**: the OS text engine (Uniscribe/DirectWrite) rasterizes → bitmap. (This is why a Sinhala receipt "just works" through the **Windows driver / system-print path** — the OS shapes it.)
- **Flutter `unified_esc_pos_printer`**, verbatim: *"For scripts not supported by the printer's built-in character tables (CJK, Arabic, Devanagari, Thai, etc.), use `textRaster()` which renders text using Flutter's text engine and prints it as an image."*
- **Generic Android ESC/POS** (DantSu #517): Tamil prints "random characters"; maintainer's advice — *"convert your text as image, then print the image."*

## Upstream issue evidence (firsthand) — and 2 RN gotchas for our build
This is filed, recurring, and unresolved upstream — which is exactly the gap chittie fills:
- **ReceiptPrinterEncoder #25 "Cannot Print Tamil" — OPEN, unanswered.** #60 "Support Unicode/Khmer" — OPEN, unanswered. react-thermal-printer #50 Arabic — OPEN.
- **#26 "Unable to print arabic"** — the maintainer's own verdict: *"ESC/POS printers are pretty dumb… right-to-left support and glyph shaping is simply not supported. My advice for proper arabic printing is to **create a bitmap, draw a text string and print that.**"* On host shaping he notes *no lightweight JS ICU exists* (only emscripten ICU, "pretty high footprint"). The thread is 25+ comments of people hand-rolling canvas / ViewShot-screenshot / server-side image. → **independently confirms our raster verdict, from the library author.**
- **CORRECTED/UPDATED — RN gotchas in the core engine (from #36 "Does this support React Native?"):** my earlier "image deps are RN-safe" was *mostly* right but missed two real RN break points the issue surfaced, both now fixable:
  1. **`structuredClone()`** is absent on older Hermes → constructor crash. Mitigation: polyfill (one-liner) or rely on Expo ≥54 (maintainer reports it works there). **WS0b must verify under Hermes and ship a polyfill if needed.**
  2. **`@canvas/image-data`** mis-resolved on RN (bundler took the browser path needing native `ImageData`) → `Cannot find 'ImageData'`. **Fixed in `@canvas/image-data` v1.1.0 (2025-10-14).** **WS0b must pin `@canvas/image-data` ≥1.1.0.**

  So the image *deps* are RN-safe **only at `@canvas/image-data` ≥1.1.0**, and the core needs a `structuredClone` guard on old Hermes. Cheap, but mandatory acceptance criteria.

## Why (encoding theory)
Indic scripts are abugidas: vowel signs **reorder** (some render left of a consonant they logically follow), consonant+virama+consonant **collapse into conjunct ligatures** (N codepoints → 1 glyph with no fixed N), and ZWJ/ZWNJ change joining contextually. So glyph identity, count, and order are all context-dependent — the defining job of a shaping engine, which a stateless byte→glyph ROM lacks. **Tamil is simpler than Sinhala** (visible pulli instead of stacked conjuncts) but still needs reordering + split vowels; **Sinhala** adds touching conjuncts, al-lakuna joins, repaya, multi-side vowel signs.

## Decision for chittie
**Pick: host-shape-then-raster, made seamless.** Concretely:
1. **Auto-detect** non-encodable / complex-script runs (Sinhala U+0D80–0DFF, Tamil U+0B80–0BFF, or "codepage-encoder returns `?`").
2. **Shape + rasterize** those runs via an **injected** platform renderer (web canvas / RN Skia — both use HarfBuzz) → `ImageData` → `core.image()`.
3. **Mixed runs**: keep Latin/digits as crisp code-page text; rasterize only the Indic run; line-compose them together.
4. **Never silent `?`**: detect unencodable codepoints and route-to-raster (or error) — strictly better than upstream's silent substitution.
This is the same mechanism the whole industry uses, but **automatic, shaped, mixed, and safe** — which neither ReceiptPrinterEncoder nor react-thermal-printer does today. That DX is chittie's differentiator.

**For the immediate Shopbook POS Windows terminal:** Sinhala already prints via the **system-print (OS driver) path** — no new code needed there. The chittie raster layer is for the *direct* (Web Serial / Bluetooth / mobile) path.

## Flip conditions
- Revisit if a thermal printer ships an **on-device shaping engine** (GIST-style) — none on the market today.
- Revisit the *narrow* text-ROM path only if you standardize on Epson **TM-P80II South-Asia SKU** AND need Tamil/Hindi only (never Sinhala) AND accept unshaped/pre-reordered output. (Low value; doesn't solve Sinhala.)

## Sources
1. Epson ESC/POS `ESC t` code-page reference (Indic pages 66–75/82; verified HTTP 200) — https://download4.epson.biz/sec_pubs/pos/reference_en/escpos/esc_lt.html
2. Epson ePOS-Print `addTextLang` (no Indic shaping) — https://download4.epson.biz/sec_pubs/pos/reference_en/epos_and/ref_epos_sdk_and_en_printerclass_addtextlang.html
3. HarfBuzz — "Why do I need a shaping engine" — https://harfbuzz.github.io/why-do-i-need-a-shaping-engine.html ; buffer/GID output — https://harfbuzz.github.io/harfbuzz-hb-buffer.html
4. Unicode 17.0 Ch. 12 "South Asian Scripts" (reordering rules) — http://www.unicode.org/versions/Unicode17.0.0/core-spec/chapter-12/ ; Indic FAQ — http://www.unicode.org/faq/indic.html
5. ISCII IS 13194:1991 — https://law.resource.org/pub/in/bis/S04/is.13194.1991.pdf
6. C-DAC GIST card / ISCII hardware shaping — https://www.cdac.in/index.aspx?id=mlc_gist_gcard
7. Sunmi printer SDK (printText vs printBitmap) — https://docs.sunmi.com/en-US/cdixeghjk491/xdideghjk524 ; iMin SDK ("(not support Arabic)") — https://oss-sg.imin.sg/docs/en/PrinterSDK.html
8. Star StarIO `appendBitmap` — https://www.star-m.jp/products/s_print/sdk/starprnt_sdk/manual/android_java/en/api_starioext.html
9. Windows GDI printing — https://learn.microsoft.com/en-us/windows/win32/printdocs/gdi-printing
10. Flutter `unified_esc_pos_printer` (`textRaster`) — https://github.com/elrizwiraswara/unified_esc_pos_printer ; DantSu Tamil issue #517 — https://github.com/DantSu/ESCPOS-ThermalPrinter-Android/issues/517 ; Star/Bixolon/Citizen/Xprinter/TVS code-page manuals (no Indic) — see escpos-printer-db https://github.com/receipt-print-hq/escpos-printer-db
