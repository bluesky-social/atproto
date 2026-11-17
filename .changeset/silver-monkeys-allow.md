---
"@atproto/bsky": patch
---

Hydrate eligible post view counts only for the authenticated author, with a bounded optional Atlantis lookup. Serving is disabled when `BSKY_POST_VIEW_COUNTS_START_AT` is unset, invalid, or in the future. Invalid values log a warning.
