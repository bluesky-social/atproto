---
"@atproto/bsky": patch
---

Hydrate eligible post view counts only for the authenticated author, with a bounded optional Atlantis lookup.

Disable serving view counts when the launch timestamp is invalid instead of preventing server startup.
