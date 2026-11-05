---
'@atproto-labs/xrpc-utils': patch
---

Ignore empty Accept-Encoding list entries as required by RFC 9110, avoiding errors when clients send extra commas.
