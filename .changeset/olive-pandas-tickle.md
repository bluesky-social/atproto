---
'@atproto/oauth-provider-api': minor
---

Remove the `ISODateString` and `ActiveDeviceSession` types, which duplicated
`ISODatetimeString` from `@atproto/syntax` and `Session` respectively. Remove
the `deleteAfter` property from `DeactivateAccountInput`, which the
`/deactivate-account` endpoint never accepted.
