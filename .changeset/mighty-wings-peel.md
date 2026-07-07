---
'@atproto/oauth-provider': minor
---

Remove internal utilities and error classes from the public API. Most notably, the package no longer re-exports the full public API of `@atproto-labs/fetch`, `@atproto-labs/fetch-node` or `@atproto/oauth-types`, and `InvalidInviteCodeError` was removed (use `InvalidRequestError` instead). This change also fixes an internal circular dependency.
