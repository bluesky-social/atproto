---
'@atproto/pds': patch
---

New accounts get a P-256 `#atproto_kem` key, stored as `kem_key` next to the signing key in the actor store, and publish it in their PLC genesis operation. On a PDS behind an entryway, the key is generated but not published.
