---
"@atproto/api": patch
---

Fix mention detection dropping handles when followed by a hyphen-separated suffix (e.g. `@handle.example.com-foo` now produces a mention facet covering `@handle.example.com`).
