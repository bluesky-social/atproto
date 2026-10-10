---
'@atproto/bsky': patch
---

Track latest and exact external record lookups in one shared traversal set, so repeated exact versions are fetched once per traversal, and key exact-version hydration maps with a branded `ExactRecordKey` whose parser rejects malformed keys. A later successful lookup of the same URI and CID may now fill a previously unavailable exact version.
