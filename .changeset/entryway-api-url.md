---
"@atproto/pds": patch
---

Add `PDS_ENTRYWAY_API_URL`, the URL this PDS uses for its own requests to the entryway, e.g. a local proxy that adds mTLS. It defaults to `PDS_ENTRYWAY_URL`, which remains the entryway's public URL: the OAuth issuer and the authorization server the PDS advertises.
