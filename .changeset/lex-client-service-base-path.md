---
'@atproto/lex-client': patch
---

Preserve the path of an agent's `service` URL when building request URLs, so services mounted under a sub-path (e.g. `https://example.com/proxy`) are addressed correctly.
