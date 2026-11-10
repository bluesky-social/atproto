---
"@atproto/lex-cbor": patch
"@atproto/lex": patch
---

Fix CBOR option declarations so strict NodeNext consumers can import Lex without checking cborg's incompatible declarations. Add a packed-consumer regression check for both entrypoints.
