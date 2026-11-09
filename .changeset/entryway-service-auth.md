---
"@atproto/pds": patch
---

Accept short-lived service JWTs from the entryway on `com.atproto.admin.deleteAccount`, `com.atproto.admin.updateAccountHandle`, `com.atproto.admin.updateSubjectStatus` and `com.atproto.server.reserveSigningKey`. Tokens must be ES256K with `typ: "JWT"`, issued by `PDS_ENTRYWAY_DID` for this PDS's service DID, bound to the called method through `lxm`, live at most 5 minutes, and be signed with the `PDS_ENTRYWAY_JWT_VERIFY_KEY_K256_PUBLIC_KEY_HEX` key. Setting `PDS_ENTRYWAY_REQUIRE_SERVICE_AUTH=true` makes these routes refuse the admin password and unauthenticated callers; `updateSubjectStatus` still accepts the moderation service. PDSes without entryway configuration are unaffected.
