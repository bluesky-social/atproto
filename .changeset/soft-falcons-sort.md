---
'@atproto/lex-client': patch
'@atproto/lex-schema': patch
'@atproto/lex-data': patch
'@atproto/lex': patch
---

Accept legacy blob references in non-strict mode. Legacy blob references (objects with `cid` and `mimeType` properties) are now accepted when `strict: false`, which is the default behavior when `strictResponseProcessing` is disabled on the Client. The `allowLegacy` option has been removed from the blob schema builder, as legacy blobs are now handled automatically based on the strictness mode: in strict mode they are rejected, in non-strict mode they are accepted.

Additionally, exported new utility functions from `@atproto/lex-data` for working with both standard and legacy blob references: `assertBlobRef`, `asBlobRef`, `ifBlobRef`, `assertLegacyBlobRef`, `asLegacyBlobRef`, `ifLegacyBlobRef`, `getBlobCid`, `getBlobCidString`, `getBlobMime`, and `getBlobSize`.
