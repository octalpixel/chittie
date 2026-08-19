---
'@angadie/chittie-react': minor
'@angadie/chittie-text': minor
'@angadie/chittie-core': patch
---

Layout elements: `<Columns>`/`<Column>`, `<Box>`, `<Row gap>`, `<Line style|width>`.

`chittie-core`'s builder has always had per-column widths, margins, padding and
borders through `table()` and `box()`, but the JSX layer exposed none of it —
`<Row>` hard-coded a two-column split and `<Line>` took no options. A receipt
could not indent a wrapped line, size a column, or keep a guaranteed gap
between a label and its amount.

- `<Row gap>` keeps blank characters between the two cells. Without it a label
  that exactly fills the remaining width sits flush against the value with
  nothing between them; a gap wraps the label one character sooner instead.
  `<Row marginLeft|marginRight>` inset the whole row.
- `<Columns>` with `<Column width|align|verticalAlign|marginLeft|marginRight>`
  is the general form. Leave `width` off one column and it takes the remainder.
  A cell wraps inside its own width, so a continuation line stays under its
  column instead of falling back to the left margin.
- `<Box>` gives an indented block with optional padding and a border. It is the
  only way to indent — leading whitespace is stripped from `<Text>` and `<Row>`.
  It defaults to `style="none"`; the builder's `box()` defaults to `single`.
- `<Line style="double">` and `<Line width>`.

`chittie-text` gains `rasterizeColumns`, the N-column form of `rasterizeRow`.
The engine refuses an image inside a table cell, so a row carrying Sinhala,
Tamil or Arabic cannot be assembled per-cell; `<Columns>` detects it and
rasterizes the whole row instead, the same way `<Row>` already did. `blit` now
clips to the destination, so an over-wide fragment can no longer spill into the
next row of the buffer.

`chittie-core` fixes three defects that made those options unusable from the
builder as well: `table()` and `box()` threw on the `align` they document as
optional, and `box()` derived its default width without allowing for its own
margins, so `box({marginLeft: 2})` always threw "Box is too wide".
