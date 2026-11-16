---
'@atproto/pds': minor
---

Migrate existing accounts to spaces readiness in the background: the schema is updated, and a KEM key is created and published to the DID document at a paced rate. New accounts are created with a published KEM key. Migration progress is reported on the health endpoint.
