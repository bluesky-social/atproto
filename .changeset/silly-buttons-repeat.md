---
'@atproto/bsky': patch
---

Reduce dataplane calls when refilling paginated responses. Pages are now served once they hold half of the requested limit, and `listNotifications` reads the viewer's priority setting and last-seen time once per request instead of once per page.
