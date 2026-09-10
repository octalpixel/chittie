---
"@angadie/chittie-preview": minor
---

Draw independently-scaled text truthfully.

ESC/POS magnifies a character's width and height separately (`GS !`), but a canvas font size scales both at once — so a row magnified in only one axis, such as a double-height total, drew as wide as it was tall and ran into its neighbour. The preview now squeezes the other axis back under a transform, using three optional `PreviewContext2D` methods (`save`, `restore`, `scale`). A context that does not supply them keeps the old square-scaled drawing, so this is not a breaking change.
