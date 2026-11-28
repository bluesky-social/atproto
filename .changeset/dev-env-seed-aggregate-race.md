---
'@atproto/dev-env': patch
---

Index seed writes that update the same AppView count one after the other, working around a lost update in bsky's indexer that made snapshot tests flaky
