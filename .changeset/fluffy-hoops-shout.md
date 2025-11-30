---
'@atproto/lex-document': patch
---

Improve performance of lexicon document schema validation by reusing singleton schema instances for commonly used types such as string, number, boolean, null, any, and empty object. This reduces memory usage and speeds up initialization.
