---
"@atproto/lex-json": patch
---

Reject `$link` values that are not data-model CIDs (CIDv1, dag-cbor or raw codec, sha-256), such as CIDv0, when parsing JSON in strict mode.
