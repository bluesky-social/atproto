---
'@atproto/lex-document': patch
---

Support `space` definitions in lexicon documents (`lexiconSpaceSchema`, `LexiconSpace`, `lexiconSpaceKeySchema`, `LexiconSpaceKey`): a main definition with a `key`, the recommended `collections`, and an optional `title` (with `title:lang`) and `description`. `LexiconSchemaBuilder` builds them as `l.Space`.
