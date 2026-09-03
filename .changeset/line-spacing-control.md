---
"@angadie/chittie-core": minor
"@angadie/chittie-react": minor
"@angadie/chittie-preview": minor
---

Control the line-feed pitch, and stop column-mode images feeding blank paper.

`ESC @` leaves a printer on its default pitch of 1/6 inch (~34 dots at 203 DPI) while font A is only 24 dots tall, so every line spent ~10 dots of paper no layout asked for, with no way to tighten it — `<Br>` and `<Feed>` only ever add.

- `encoder.lineSpacing(dots)` and `<Printer lineSpacing>` / `render({ lineSpacing })` set the pitch (`null` restores the printer default). A column-mode image restores the printer default when it finishes, which would silently undo the setting from the first image onward — on a non-Latin receipt that is every line — so the encoder now re-asserts it after each one.
- Fixed the column-mode image band pitch: it emitted `ESC 3 0x24` (36 dots) for bands that are 24 dots tall, feeding 12 blank dots between every band of every image.
- `chittie-preview` now models the pitch (`ESC 2` / `ESC 3 n`) instead of assuming a constant line height, so a mis-set pitch shows up in the preview instead of only on paper. `lineHeight` is now the default pitch that `ESC 2` restores.

Measured on a 5-item 48-column receipt: a Latin receipt drops 52.8 mm to 37.8 mm, and a fully rasterized Sinhala receipt 54.1 mm to 37.8 mm.
