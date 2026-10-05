---
"@atproto/lex-installer": minor
"@atproto/lex-builder": minor
"@atproto/lex": patch
---

Resolve Lexicons from local files, not only the network.

- `lex install` now treats a positional argument as a local file whenever it is a `file://` URI or contains a slash, reading it from disk and symlinking it into the `lexicons/` directory.
- The `lexicons.json` manifest gains an ordered `resolvers` array of local override strategies (currently `{ type: "directory", path, include?, exclude? }`), consulted before the network fallback. Manifest lock URIs may now be `file://` (relative to the manifest) in addition to `at://`.
- Local-file resolutions are symlinked rather than copied (left in place when source and destination are the same path).
- `@atproto/lex-builder` now exports `buildFilter`.
