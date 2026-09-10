---
"@angadie/chittie-react": minor
"@angadie/chittie-preview": patch
"@angadie/chittie-core": patch
---

`<Row height>` for the one row that has to outweigh the rest, and the real default pitch.

- `<Row height={2}>` magnifies a row vertically, for a total that should not read like another subtotal. Height only: a cell measures its text at 1x, so a *widened* row would print wider than the columns it was laid out in — that is not offered rather than offered broken.
- Corrected the documented printer default pitch. It is 30 dots on a 203-DPI TM printer (Epson's ESC 3 reference), not the ~34 the docs claimed by converting 1/6 inch. So `lineSpacing(24)` saves 6 dots per line, not 10 — a 48-column Latin receipt goes 46.8 mm to 37.8 mm, not 52.8 mm.
- `chittie-preview` now feeds a line by `max(pitch, character height)` rather than `pitch x magnification`, which is what the printer actually does: "if the character height is greater than the line spacing specified by this command, the paper is fed the amount of the character height". A magnified row is therefore never clipped by a tight pitch, and costs exactly the glyph it draws.
