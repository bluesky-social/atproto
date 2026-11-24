---
'@atproto/syntax': patch
'@atproto/lex-schema': patch
'@atproto/lex-space': patch
---

Keep reading space URIs in their spaces alpha form, `at://{spaceDid}/space/...`, so records written during the alpha stay valid. Lenient validation (`strict: false`) of the `at-uri` and `space-ref` formats accepts it, and `AtUri` reads it and prints the `at:space/` form; strict validation and `SpaceRef.parse()` accept only the current form. `SpaceClient` and `SpaceReader` validate the records they read leniently. Adds `fromLegacySpaceUri()`, an `options` argument to `isSpaceRefString()`, and `isSpaceRefStringLenient()`. Support for the old form will be removed before beta.
