---
'@atproto/bsky': patch
'@atproto/ozone': patch
---

Accept only internal service tokens on the internal endpoints, and remove the `viewer` parameter from `internal.bsky.actor.getProfiles`. `app.bsky.feed.getPosts` and `app.bsky.actor.getProfiles` no longer accept service JWTs for `chat.bsky.*` methods. Ozone no longer installs the unused `internal.bsky.actor.getProfiles` lexicon.
