---
'@atproto/lex-server': patch
---

`terminate()` now closes WebSocket connections with a 1001 (Going Away) status code, which aborts their subscription handlers, instead of leaving them open until `gracefulTerminationTimeout` expires. When `gracefulTerminationTimeout` is not set, `terminate()` now waits up to 1 second for in-flight requests to complete, instead of closing every connection immediately.
