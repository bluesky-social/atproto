---
'@atproto/ws-client': patch
---

Add the `lookup` option (Node.js), a `LookupFunction` that resolves the host in place of `dns.lookup()`. Like `headers`, it throws in the browser.
