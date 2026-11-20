---
"@atproto/lex-space": patch
---

`SpacePolicyManager#updatePolicy()` throws `UnsupportedSpacePolicyError` when the space has been migrated to another policy since the manager was opened, instead of sending its own policy and migrating the space back.
