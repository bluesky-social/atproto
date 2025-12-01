---
'@atproto/lex-schema': patch
---

Discriminated unions now only accept discriminators to be declared a `literal` or `enum` schemas and will throw at initialization if discriminators values aren't strictly disjoined.
