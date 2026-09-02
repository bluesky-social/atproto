---
'@atproto/dev-env': minor
---

Migrate `dev-env` off `@atproto/api` and `@atproto/lexicon` onto `@atproto/lex`. The package now runs `lex build` codegen, and `TestOzone` gained a `getClient()` alongside its existing `getAgent()`.

`getAgent()` on `TestPds` / `TestBsky` / `TestOzone` and `SeedClient.agent` are unchanged — they remain as the compatibility surface for test suites that still drive `AtpAgent`.

Breaking, for direct consumers of these helpers:

- `ModeratorClient.agent` is replaced by `ModeratorClient.client` (a `Client`), and its methods return the response body directly rather than an `{ data }` wrapper.
- `ServiceProfile` holds a `PasswordSession` plus a `Client` instead of an `AtpAgent`.
- `SeedClient` builds every record through `Client`, so `uploadFile` and `createProfile` now return a `BlobRef` from `@atproto/lex-data` rather than the `@atproto/lexicon` class. Read its CID with `getBlobCid()` / `getBlobCidString()` instead of `.ref`.
- Branded types are applied at these boundaries: `ServiceUserDetails.handle` (`HandleString`), `DidAndKey.did` and `TestFeedGen.did` (`DidString`), `SeedClient.uploadFile`'s `encoding` (`EncodingString`), and record `createdAt` overrides (`DatetimeString`).
