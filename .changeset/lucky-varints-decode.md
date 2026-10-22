---
'@atproto/car': patch
---

Fix `decodeVarInt` throwing `varint.decode is not a function` under Node's ESM/CJS interop, which made every CAR read fail in built output.
