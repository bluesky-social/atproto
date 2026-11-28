---
'@atproto/bsky': patch
'@atproto/dev-env': patch
---

Add a `backgroundConcurrency` option to `RepoSubscription`, which dev-env sets to 1 so the AppView's count recounts run one at a time, working around a lost update in bsky's indexer that made snapshot tests flaky
