---
'@atproto/lex-client': minor
---

`BinaryBodyInit` (used for binary request bodies and unknown response payloads) now uses `Uint8Array<ArrayBuffer>` rather than `Uint8Array`, matching the buffer-backed (not shared-memory) byte arrays expected by Web APIs. Most callers can pass values through unchanged; in the rare case of a `SharedArrayBuffer`-backed `Uint8Array`, copy into a regular `Uint8Array` first.
