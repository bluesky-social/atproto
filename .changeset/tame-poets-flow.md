---
'@atproto/pds': patch
'@atproto/bsky': patch
'@atproto/aws': patch
'@atproto/xrpc-server': patch
---

Remove `key-encoder` dependency (and its `elliptic`/`asn1.js`/`bn.js` transitive tree) in favor of Node's native JWK key import and the already-present `@noble/curves`
