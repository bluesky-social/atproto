---
'@atproto/dev-env': patch
---

Close the services already started when creating a test network, PDS, AppView, bsync or Ozone instance fails partway through. `TestPlc` and `TestBsync` now implement `Symbol.asyncDispose`, like the other fixtures.
