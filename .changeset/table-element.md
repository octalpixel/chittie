---
'@angadie/chittie-react': minor
---

`<Table>` — rows that share one set of columns, and content-sized columns.

`<Columns>` describes a single row, so every repeated line has to restate the
same widths and nothing enforces that they match. `<Table>` declares the
columns once and takes `rows`, so a repeated line shape is aligned by
construction.

It also adds `width: 'auto'`, which sizes a column to its widest cell across
every row. That cannot be expressed with `<Columns>` — a single row cannot know
what the others contain — so every consumer was computing it by hand:

```tsx
<Table
  gap={1}
  columns={[{ width: 3 }, {}, { width: 'auto', align: 'right' }]}
  rows={items.map((it) => [`${it.qty}x`, it.name, money(it.total)])}
/>
```

Cells accept plain strings or printable nodes. A row needing raster becomes one
image while the rest stay text, in the order written.

Also fixes a defect in 0.11.0: a bare string child was silently dropped, so
`<Column>2x</Column>` and `<Box>Thank you</Box>` printed nothing unless the
text was wrapped in `<Text>`. Strings now print as their own line.
