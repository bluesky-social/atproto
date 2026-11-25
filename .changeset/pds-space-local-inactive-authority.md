---
"@atproto/pds": patch
---

A repo update notification for a space whose authority is a deactivated or taken-down account on the same PDS is processed locally, as it is for an active one, rather than sent to the PDS's own public URL. Space requests to other hosts go through `ctx.safeClient()`.
