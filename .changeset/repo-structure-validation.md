---
'@atproto/repo': patch
---

Validate repository structure when verifying repo CARs and diffs: record keys must be normalized `collection/rkey` paths, keys must stay within their subtree bounds, leaves must sit on the MST layer their key hash selects, node entries must use canonical prefix compression, and the MST must be a pruned tree. Previously `verifyRepoCar()` accepted CARs that violated these invariants despite having valid signatures and CIDs.
