---
'@atproto/oauth-provider-ui': patch
---

Fix the OAuth consent screen overstating what an application can do. A request
scoped to a few specific `app.bsky.*` collections (e.g. only creating
`app.bsky.feed.post` records) no longer claims the app can "Manage your profile,
posts, likes and follows". The blanket wording is now reserved for requests that
actually grant broad write access (any collection or `transition:generic`);
narrowly scoped Bluesky requests are described as accessing specific parts of the
account and surface the exact per-collection breakdown instead.
