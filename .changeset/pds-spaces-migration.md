---
'@atproto/pds': patch
---

Prepare existing accounts for spaces in the background by updating their local storage, creating encryption (KEM) keys, and publishing those keys to their DID documents. Local preparation includes deactivated accounts; publishing waits until an account is active. New accounts created directly on the PDS publish their KEM key when they are created.

The migration is enabled by default. Operators can configure it with:

- `PDS_SPACES_MIGRATION`: `enabled` runs the background migration, `disabled` pauses it, and `complete` stops it once migration is finished. Set `complete` only after all accounts have been migrated.
- `PDS_SPACES_MIGRATION_SWEEP_INTERVAL_MS`: the delay between local account preparations, defaulting to 25 ms.
- `PDS_SPACES_MIGRATION_PUBLISH_INTERVAL_MS`: the delay between background key publications, defaulting to 4,500 ms. Publishing slows down when PLC is overloaded or rate limits requests.
- `PDS_SPACES_MIGRATION_JITTER_WINDOW_MS`: the window for a random initial publishing delay, defaulting to 24 hours. The selected start time is saved across restarts.

Report migration progress and publisher status through `/xrpc/_health`. Add authenticated operator endpoints to prepare accounts, confirm key publication, check migration status, and recount progress. When running behind an entryway, the PDS prepares accounts locally and the entryway handles publication. Entryways can use `com.atproto.server.reserveKemKey` to reserve a key for a new account.

Include the KEM key in recommended DID credentials and reject PLC updates that remove a published local KEM key or name a key the PDS does not hold. Once `PDS_SPACES_MIGRATION` is `complete`, activating an account on a PDS without an entryway requires its DID document to match the local KEM key, if one exists. Accounts using `did:web` may omit the key from their DID document.
