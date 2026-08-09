---
'@atproto/bsky': patch
---

Limit blob proxy retries for HTTP 429 responses to one retry while retaining the configured retry count for other transient failures.
