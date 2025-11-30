---
'@atproto/lex-schema': patch
---

Validation issues are now child classed to the `Issue` abstract class instead of simple objects with interfaces. This allows for better extensibility and custom behavior on issues (such as custom error messages).
