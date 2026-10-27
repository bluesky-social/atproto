---
"@atproto/xrpc-server": patch
"@atproto/pds": patch
"@atproto/oauth-provider": patch
---

Bound the decoded size of every stage of a multi-coding `content-encoding` chain, and reject bodies listing too many content-codings
