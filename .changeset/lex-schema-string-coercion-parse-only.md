---
'@atproto/lex-schema': patch
---

When validating (not parsing), string schemas reject values they would coerce to a string (`Date`, `URL`, CID, token, `String` object) with an `invalid_type` issue, instead of checking the string constraints of the coerced value before failing with an `invalid_value` issue.
