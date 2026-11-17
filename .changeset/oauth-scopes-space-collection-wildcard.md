---
"@atproto/oauth-scopes": patch
---

`ScopePermissions#allowsSpace()` and `assertSpace()` accept `collection: '*'` for a `create`, `update` or `delete` check, which only a grant covering every collection matches.
