---
'@atproto/bsky': patch
---

Mark refs passed directly to `hydrateExternalViewDependencies` as seen, including unavailable and invalid records, so nested passes do not refetch them.
