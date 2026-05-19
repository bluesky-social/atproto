---
'@atproto/common': minor
---

**BREAKING:** `ui8ToArrayBuffer(bytes)` now requires `Uint8Array<ArrayBuffer>` (rather than `Uint8Array`, which defaults to `<ArrayBufferLike>`). Most callers can pass the value through unchanged; in the rare case of a `SharedArrayBuffer`-backed `Uint8Array`, copy into a regular `Uint8Array` first.
