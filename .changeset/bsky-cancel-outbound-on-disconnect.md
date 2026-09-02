---
'@atproto/bsky': patch
---

Abort upstream calls made by read endpoints when the client disconnects. Feed, search, and suggestion queries now forward the request's cancellation signal to their outbound calls, so a caller hanging up no longer leaves those requests running.
