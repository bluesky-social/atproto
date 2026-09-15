---
'@atproto/dev-env': patch
---

Write the test port allocator's owner file atomically so a concurrent sweep cannot delete it while it is still empty.
