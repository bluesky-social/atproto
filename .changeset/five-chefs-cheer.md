---
'@atproto/api': patch
---

Trust `status` returned from `refreshSession` and do not fall back to a potentially stale value from `this.session`.
