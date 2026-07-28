---
'@atproto/oauth-client-browser': minor
---

**BREAKING:** The session hooks exposed on `BrowserOAuthClientOptions` have been renamed: `onUpdate` → `onSessionUpdated` and `onDelete` → `onSessionDeleted` (following the rename in `@atproto/oauth-client`).
