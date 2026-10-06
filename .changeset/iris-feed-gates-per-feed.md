---
'@atproto/bsky': patch
---

Gate each iris-served Discover feed separately: with-friends, thevids, mutuals, bsky-team, best-of-follows, and followpics get their own `iris:feed:<feed>:enable` gates, while whats-hot and any other allowlisted feed keep the original `iris:feed:enable` gate.
