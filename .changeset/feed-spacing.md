---
"@angadie/chittie-react": minor
---

Add `<Feed dots={n}>` — precise one-shot vertical spacing (ESC J), finer than `<Br lines>`.
It doesn't touch global line spacing (so no conflict with the image feed), giving consumers a
clean way to tune gaps. Note: `<Text size>` is character magnification (1–8), not line spacing;
spacing control is `<Br lines>` (line-level) + `<Feed dots>` (dot-level) + `<Text inline>`.
