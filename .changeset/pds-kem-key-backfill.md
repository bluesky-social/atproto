---
'@atproto/pds': patch
---

On startup, a single PDS process, chosen by a database lease, gives a `#atproto_kem` key to each existing account. If the PDS holds a rotation key and still hosts the account, it publishes the key to the account's PLC document and emits an identity event. For any other account, the owner must publish the key. The backfill records its completion and does not run again. It does not run on a PDS behind an entryway.
