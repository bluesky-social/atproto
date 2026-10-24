---
'@atproto/bsky': patch
---

Clamp `seenAt` in `app.bsky.notification.updateSeen` to the current time, so a future date no longer marks new notifications as read.
