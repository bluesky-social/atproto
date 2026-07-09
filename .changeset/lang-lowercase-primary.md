---
'@atproto/syntax': patch
---

`parseLanguageString` (strict validation) now rejects language tags whose
primary language subtag is uppercase (for example `JA`) or is a bare
four-letter run (for example `jaja`). The primary language subtag must be a
lowercase two-or-three-letter code per RFC 5646 §2.1.1, matching the atproto
interop test suite. `isValidLanguage` is unchanged and stays permissive of
these legacy forms (well-formed syntax only), so existing records are not
retroactively invalidated. Well-formed lowercase tags are unaffected.
