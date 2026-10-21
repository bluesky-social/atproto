---
"@atproto/pds": patch
"@atproto/api": patch
---

Reliably deliver `com.atproto.space.notifySpaceDeleted` to the syncers registered for a deleted space. Retryable failures are persisted in the account-manager database and retried with backoff until delivered or until the syncer's registration expires; permanent HTTP errors are not retried.

Correct the `com.atproto.simplespace.deleteSpace` description: other members' repos are left untouched on deletion, not flagged.
