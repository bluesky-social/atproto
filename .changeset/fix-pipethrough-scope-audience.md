---
'@atproto/pds': patch
---

Fix scope check 403s for OAuth tokens using `include:` permission-set scopes with `inheritAud`. The pipethrough now preserves the service fragment (e.g. `#bsky_appview`) in the audience for scope matching, while stripping it from the JWT audience sent to the receiving service.
