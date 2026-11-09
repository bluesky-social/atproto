---
"@atproto/pds": patch
---

Attribute entryway traffic for rate limiting by signed tokens instead of by IP address. A request carrying a valid entryway service JWT in `Authorization` bypasses rate limits. A user request the entryway proxies may carry an `x-entryway-relay` token (ES256K, `typ: "JWT"`, issued by `PDS_ENTRYWAY_DID` for this PDS's service DID, no `lxm`, at most 120 seconds long, signed with the `PDS_ENTRYWAY_JWT_VERIFY_KEY_K256_PUBLIC_KEY_HEX` key); when it verifies, the request's IP address (`req.ip`) becomes the token's `client_ip`, in canonical form, so rate limits key on the end user. Invalid relay tokens are ignored and logged at debug level with a short reason code, and request logs redact the `x-entryway-relay` header. `com.atproto.admin.getSubjectStatus` now also accepts the entryway service JWT. `PDS_RATE_LIMIT_BYPASS_IPS` keeps working as before, and PDSes without entryway configuration are unaffected.
