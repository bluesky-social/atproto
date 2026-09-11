---
'@atproto/pds': patch
---

Bound the decoded size of the upstream responses that the proxy buffers — error
bodies, and the read-after-write path — at `proxy.maxResponseSize`, which
previously bounded only the bytes read off the wire. A response that decodes
past the bound fails as an upstream error.
