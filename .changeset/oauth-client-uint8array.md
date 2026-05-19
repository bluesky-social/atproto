---
'@atproto/oauth-client': minor
---

`RuntimeImplementation.digest(data, alg)` now takes `data: Uint8Array<ArrayBuffer>` rather than `Uint8Array`. This only affects consumers who implement `RuntimeImplementation` themselves rather than using one of the prebuilt impls (`@atproto/oauth-client-browser`, `@atproto/oauth-client-node`, `@atproto/oauth-client-expo`). Most callers can pass values through unchanged; in the rare case of a `SharedArrayBuffer`-backed `Uint8Array`, copy into a regular `Uint8Array` first.
