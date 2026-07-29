---
'@atproto/xrpc-server': patch
---

Parse repeated query parameters from the request URL so Express query parser array limits do not collapse XRPC array params above 20 values.