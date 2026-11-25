---
'@atproto/pds': minor
---

Migrate existing accounts to spaces readiness in the background: the schema is updated, and a KEM key is created and published to the DID document at a paced rate. New accounts are created with a published KEM key. Migration progress is reported on the health endpoint. `PDS_SPACES_MIGRATION` sets the migration's state: `disabled`, `enabled` (the default), or `complete` once every account has been migrated.

Use PLC client `1.0.0-next.0` for KEM-aware genesis operations and cancellable migration requests. Prepare actor stores with the spaces schema and paging indexes from the permissioned-data branch.
