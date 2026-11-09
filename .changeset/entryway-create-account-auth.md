---
"@atproto/pds": patch
---

Accept the entryway's service JWT on `com.atproto.server.createAccount` when the PDS runs behind an entryway, on the same terms as the other entryway-called routes (`lxm` `com.atproto.server.createAccount`, `aud` this PDS's service DID); a valid one bypasses rate limits. Behind an entryway, a bearer token on this route must be such a JWT: other bearer tokens are no longer verified as user service auth. Unauthenticated calls are still accepted, even with `PDS_ENTRYWAY_REQUIRE_SERVICE_AUTH=true`, so that the entryway can start signing this call; enforcement under that setting follows in a later release, once it does. PDSes without entryway configuration are unaffected.
