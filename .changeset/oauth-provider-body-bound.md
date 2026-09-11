---
'@atproto/oauth-provider': patch
---

Bound the request bodies accepted by the OAuth and account-management endpoints
at 100 KiB. The bound is on the decoded body, so a compressed request is
measured after decompression, and a `content-length` above it is rejected
without reading the body. Oversized bodies fail with a 413.
