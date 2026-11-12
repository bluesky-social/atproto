---
"@atproto/pds": patch
---

With `PDS_ENTRYWAY_REQUIRE_SERVICE_AUTH=true`, `com.atproto.server.createAccount` now requires the entryway's service JWT, as the other entryway-called routes do: unauthenticated calls are refused with `AuthenticationRequired`. Enable that setting only once the entryway in front of the PDS signs its `createAccount` calls. Without it, unauthenticated calls are still accepted, and PDSes without entryway configuration are unaffected.
