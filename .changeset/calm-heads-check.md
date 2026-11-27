---
"@atproto/lex-server": patch
---

Accept `HEAD` requests on `/xrpc/_health`, pass the `ConnectionInfo` to the `healthCheck` handler, and set `cache-control: max-age=5` on its response
