---
"@angadie/chittie-core": patch
---

Centre magnified text where it belongs.

Alignment padding is measured in cells but printed as space characters, and a magnified character covers `style.width` cells. The cell count was emitted verbatim, so a centred double-width line padded twice as far as it meant to and ended up flush against the right edge — a receipt header printed at `size={{ width: 2, height: 2 }}` was visibly off. Right alignment had the same fault. The padding is now divided by the character width, which leaves every unmagnified line byte-identical.
