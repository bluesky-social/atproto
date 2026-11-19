---
'@atproto/lexicon': patch
---

Allow the `$type` discriminator on `LexiconDoc` so that generated `lexicons.ts` files — which embed each document's JSON verbatim, `"$type": "com.atproto.lexicon.schema"` included — satisfy `Record<string, LexiconDoc>` without a type error.
