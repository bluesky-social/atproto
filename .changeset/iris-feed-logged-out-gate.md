---
'@atproto/bsky': patch
---

Route logged-out `getFeed` requests for allowlisted feeds to Iris behind the new `iris:feed:logged_out:enable` feature gate. Logged-out viewers are bucketed by their stable device id (stable_id) instead of a DID.
