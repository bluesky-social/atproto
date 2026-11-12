---
"@atproto/space": minor
"@atproto/crypto": patch
---

Derive the shared secret for space repo MACs with HPKE secret export (RFC 9180 §6.2), using DHKEM(P-256, HKDF-SHA256), HKDF-SHA256 and the Export-only AEAD, with `info` set to `atproto-mac` and an empty exporter context. The syncer's ephemeral key, still sent as the `keyid` of its MAC request, is HPKE's `enc`.

In `@atproto/crypto`, replace `hkdfSha256` with `hkdfExtractSha256` and `hkdfExpandSha256`.
