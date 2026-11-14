---
'@atproto/oauth-scopes': minor
---

Support the `space:` OAuth scope, which grants access to permissioned spaces: `space:<spaceType>` (or `space?spaceType=…`), narrowed by `authority` (`self` by default), `skey`, `collection`, `action` (`read_self`, `read`, `create`, `update`, `delete`) and `manage` (`create`, `update`, `delete`).

- Add `SpacePermission`, whose `withDefaultCollections()` and `withResolvedAuthority()` materialize a bare grant and a `self` authority at token issuance. `isAtprotoOauthScope()`, `normalizeAtprotoOauthScopeValue()` and `ScopesSet` handle `space:` scopes.
- Add `ScopePermissions#allowsSpace(target, operation)` and `assertSpace(target, operation)`, where the target is a space ref string, an object with `spaceDid`, `spaceType` and `skey`, or a match reference that may hold wildcards. `transition:generic` grants no space access.
- `include:` permission sets may declare `space` permissions, whose space type must fall under the set's NSID authority, so `IncludeScope#toPermissions()` and `toScopes()` can return them.
