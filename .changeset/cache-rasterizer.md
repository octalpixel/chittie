---
"@angadie/chittie-text": minor
---

Add `cacheRasterizer(inner, maxEntries?)` — an LRU-memoizing wrapper around a `TextRasterizer`
so repeated `(text, options)` pairs (the same header/greeting/labels on every receipt) are
shaped once and reused. Upstreams the logo/raster-caching pattern ordereka built app-side.
