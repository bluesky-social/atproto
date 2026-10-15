---
"@atproto/ozone": patch
---

Fix temporary tag renewal and record expiry. Reissued tags replace their pending deadline, permanent reissues clear it, and expiry workers ignore stale or already consumed work.
