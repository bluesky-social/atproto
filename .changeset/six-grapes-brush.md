---
'@atproto/oauth-client': minor
---

**BREAKING:** Throw an `AggregateError` containing every error that occurred while saving session data from the `SessionGetter` to the `SessionStore`.
