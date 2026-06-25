---
'@atproto/bsky': patch
'@atproto/bsync': patch
'@atproto/dev-env': patch
---

Subscribe to the real bsync service in dev-env instead of using a mock, with a `BsyncSubscription` on the bsky dataplane that consumes the mute, notif, and operation streams. Supports immediate shutdown (aborting in-flight long-polls) and cursor-based draining so tests stay fast.
