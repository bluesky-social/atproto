---
"@atproto/pds": minor
---

Reject a space write with `SpaceNotFound` when the writer is the space authority and the space does not exist or has been deleted. Writes to another authority's space still create the repo without checking that the space exists.
