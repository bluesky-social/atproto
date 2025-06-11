---
"@atproto/xrpc-server": minor
---

Now applies global rate limiter to every single route. Previously, the global rate limiter was not applied if a route defined a local rate limit option.
