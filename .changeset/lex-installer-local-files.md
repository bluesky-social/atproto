---
"@atproto/lex-installer": minor
"@atproto/lex": patch
---

`lex install` now resolves Lexicons from local files, not only the network. The `lexicons.json` manifest gains an ordered `resolvers` array of local override strategies (currently `{ type: "directory", path, include?, exclude? }`), consulted before the network fallback. Manifest lock URIs may now be `file://` (relative to the manifest) in addition to `at://`. Local-file resolutions are symlinked rather than copied (left in place when source and destination are the same path). `resolvers` can also provide a strategy that uses a specific AT Protocol repository.
