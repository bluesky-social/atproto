---
'@atproto/pds': patch
---

Proxy requests to the configured AppView (`PDS_BSKY_APP_VIEW_URL`) skip SSRF protection, so the AppView may be at a private address without setting `PDS_DISABLE_SSRF_PROTECTION`. Every other proxy target, including service endpoints from DID documents, keeps SSRF protection.
