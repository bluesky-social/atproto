---
'@atproto/syntax': patch
---

Fix `isValidUri` scheme validation to follow RFC 3986 (`ALPHA *( ALPHA / DIGIT / "+" / "-" / "." )`) instead of `\w+`, so URIs with `+`, `-`, or `.` in the scheme (e.g. `web+ap:`, `git+https:`, `content-type:`) are accepted and invalid schemes (leading digit, `_`, leading `+`/`-`/`.`) are rejected.
