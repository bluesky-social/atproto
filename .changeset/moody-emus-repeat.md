---
'@atproto/lex-schema': patch
---

Discriminated unions now only accept discrimitators to be declared a `literal` or `enum` schemas and will throw at initialization if discriminatores values aren't strictly disjoined.
