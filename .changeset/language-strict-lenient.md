---
'@atproto/common': minor
'@atproto/lex-schema': minor
'@atproto/lex': minor
---

Language-tag string-format validation now has strict and lenient variants, matching the pattern already used for `at-uri` and `datetime`. `isLanguageString` (and the default `language` string-format verifier) is now strict and rejects BCP 47 tags that violate RFC 5646 §4.1 (e.g. duplicate variant subtags or duplicate extension singletons). Pass `{ strict: false }` to fall back to the lenient (syntax-only) verifier, `isLanguageStringLenient`.
