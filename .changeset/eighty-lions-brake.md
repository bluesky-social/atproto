---
'@atproto/ozone': minor
'@atproto/dev-env': patch
---

Migrate Ozone onto `@atproto/lex`.

Ozone was the last package still generating its server stack with
`lex gen-server`. It now uses `lex build` like `pds` and `bsky`, and the legacy
`src/lexicon` tree is gone:

- All 95 route registrations moved from `server.<ns>.<method>()` to
  `server.add(schema, …)` from `@atproto/xrpc-server`.
- `AtpAgent` is replaced by `Client`; `CredentialSession` by `PasswordSession`
  from `@atproto/lex-password-session`.
- Kysely schema types, config and auth credentials now carry the branded
  scalars (`DidString`, `DatetimeString`, `AtUriString`, `UriString`), so
  route params flow into the database and back out into views without casts.

`@atproto/api` and `@atproto/lexicon` move to `devDependencies` (the test suites
still drive the legacy client), and `@atproto/xrpc` and `@atproto/lex-cli` are
dropped entirely.

Two behaviour changes worth noting, both from validating against the Lexicon
schemas rather than the legacy runtime:

- The AT Proto data model has no floating-point numbers, and the legacy stack
  accepted them anyway. A non-integer number in an `unknown` field — for
  example a float stored in a `tools.ozone.setting` value — is now rejected at
  input validation. Reads are unaffected, since the server is configured with
  `validateResponse: false`.
- A value whose shape contradicts the Lexicon is now rejected by schema
  validation before a route's own validators run, so the reported error is the
  schema's (`Expected object value type …`) rather than the application's.

`BlobDiverter` and the OAuth-preferences proxy previously threw `XRPCError` from
`@atproto/xrpc` to signal retryability to `retryHttp`. They now throw
`UpstreamHttpError`, which extends `XRPCError` from `@atproto/xrpc-server` so
that an error escaping a handler still carries its upstream status and message
instead of collapsing into a generic 500.
