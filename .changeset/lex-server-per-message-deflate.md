---
'@atproto/lex-server': minor
---

**Breaking:** WebSocket compression (permessage-deflate) is now disabled by default on Node.js, as in `ws`. It costs a zlib stream per connection and compresses every message, which limits how many subscribers a process can serve. Enable it with the new `perMessageDeflate` option of `serve()`, `createServer()`, `toRequestListener()` and `sendResponse()`, which accepts `ws`'s options, e.g. `{ serverNoContextTakeover: true, threshold: 1024 }`.
