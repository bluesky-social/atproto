---
"@atproto/repo": patch
"@atproto/pds": patch
---

Reject MSTs that reference the same node more than once. Full-tree traversals and diffs now throw `VisitedCidError` instead of re-walking shared subtrees, bounding their cost by the number of unique blocks. `com.atproto.repo.importRepo` returns `InvalidRequest` for such repos.
