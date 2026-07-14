---
'@atproto/lex-installer': patch
---

`writeJsonFile` (used by `lex install` to save `lexicons.json` and the installed lexicon documents) now ends the file with a trailing newline, so it no longer thrashes against formatters and linters that enforce a final newline.
