---
'@atproto/oauth-client': patch
---

Allow custom `RuntimeImplementation` to return a `SharedArrayBuffer`-backed `Uint8Array` from the `digest()` method. Input to this function will always be `Uint8Array<ArrayBuffer>`.
