---
'@atproto/oauth-client-node': minor
---

**BREAKING:** The session hooks exposed on `NodeOAuthClientOptions` have been renamed: `onUpdate` → `onSessionUpdated` and `onDelete` → `onSessionDeleted` (following the rename in `@atproto/oauth-client`).
