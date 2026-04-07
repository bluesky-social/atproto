---
'@atproto/lex-client': patch
'@atproto/lex-schema': patch
'@atproto/lex-data': patch
'@atproto/lex': patch
---

Accept legacy blob references in non-strict mode. Legacy blob references (objects with `cid` and `mimeType` properties) are now accepted when `strict: false`, which is the default behavior when `strictResponseProcessing` is disabled on the Client.

BREAKING: The `allowLegacy` option has been removed from the blob schema builder, and legacy blobs are now handled automatically based on the strictness mode: in strict mode they are rejected, and in non-strict mode they are accepted. Consumers should stop passing `allowLegacy` and rely on strictness configuration instead. Likewise, CLI consumers should stop using the removed `--allowLegacyBlobs` flag and use the default strict/non-strict behavior.
