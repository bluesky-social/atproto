---
"@atproto/bsky": patch
---

Send sitemap responses with a single `res.end()` instead of piping a stream, and forward unexpected sitemap errors to the shared error handler.
