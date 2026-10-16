---
'@atproto/pds': patch
---

`updateHandle` now checks whether the DID document's `alsoKnownAs` already reflects the requested handle before attempting to sign a PLC update. This unblocks self-custodied accounts whose owner already published the change directly, and also avoids submitting a redundant PLC operation when a PDS-custodied update is retried after a partial failure (the PLC write succeeded but the local database write did not).
