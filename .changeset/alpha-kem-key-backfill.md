---
"@atproto/pds": patch
---

Backfill `#atproto_kem` keys for accounts created before they existed. On startup, one PDS process (selected by a lease) generates each missing key and publishes it to the account's PLC document in the background, then records completion so it never runs again.
