---
'@atproto/syntax': patch
---

`isValidLanguage` and `parseLanguageString` now accept BCP 47 tags whose
private-use subtag uses an uppercase `X` (for example `X-fr-CH` or `de-X-foo`).
Per RFC 5646 §2.1.1 (and RFC 5234 §2.3, which makes ABNF quoted-string literals
case-insensitive), private-use subtags are case-insensitive, so these tags are
well-formed. Previously only the lowercase `x` form was matched. Lowercase tags
behave exactly as before.
