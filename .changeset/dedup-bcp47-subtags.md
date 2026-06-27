---
'@atproto/syntax': patch
---

Reject duplicate variant subtags and duplicate extension singleton subtags in `isValidLanguage` / `parseLanguageString`, per RFC 5646 §4.1.
