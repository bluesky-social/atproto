---
'@atproto/syntax': minor
---

`parseLanguageString` now rejects BCP 47 tags with duplicate variant subtags or duplicate extension singleton subtags, per RFC 5646 §4.1. `isValidLanguage` continues to check only well-formed syntax (§2.1) and is unchanged.
