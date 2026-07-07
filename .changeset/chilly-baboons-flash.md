---
'@atproto/oauth-provider': minor
---

**BREAKING:** Replace the single barrel entrypoint with smaller, more focused export paths. The package no longer exposes a root (`.`) export; consumers must now import from one of the following entrypoints:

- `@atproto/oauth-provider/provider` — `OAuthProvider` and its configuration types (also re-exports the public API of `@atproto/jwk`, `@atproto/jwk-jose` and `@atproto/lex-resolver`, as well as `safeFetchWrap` from `@atproto-labs/fetch-node`)
- `@atproto/oauth-provider/verifier` — `OAuthVerifier` and token verification types
- `@atproto/oauth-provider/errors` — all error classes (`OAuthError` and its subclasses)
- `@atproto/oauth-provider/store` — all the types needed to implement the various stores (`AccountStore`, `ClientStore`, `DeviceStore`, `LexiconStore`, `ReplayStore`, `RequestStore`, `TokenStore`)
- `@atproto/oauth-provider/hooks` — `OAuthHooks` and related types
- `@atproto/oauth-provider/middleware` — `oauthMiddleware`
- `@atproto/oauth-provider/constants` — public constants
- `@atproto/oauth-provider/utils` — miscellaneous utilities (e.g. `buildProtectedResourceMetadata`)
