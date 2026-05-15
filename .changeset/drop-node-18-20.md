---
'@atproto/bsky': patch
'@atproto/bsync': patch
'@atproto/ozone': patch
'@atproto/pds': patch
'@atproto/api': minor
'@atproto/aws': minor
'@atproto/common': minor
'@atproto/common-web': minor
'@atproto/crypto': minor
'@atproto/dev-env': minor
'@atproto/did': minor
'@atproto/identity': minor
'@atproto/jwk': minor
'@atproto/jwk-jose': minor
'@atproto/jwk-webcrypto': minor
'@atproto/lex': minor
'@atproto/lex-builder': minor
'@atproto/lex-cbor': minor
'@atproto/lex-cli': minor
'@atproto/lex-client': minor
'@atproto/lex-data': minor
'@atproto/lex-document': minor
'@atproto/lex-installer': minor
'@atproto/lex-json': minor
'@atproto/lex-password-session': minor
'@atproto/lex-resolver': minor
'@atproto/lex-schema': minor
'@atproto/lex-server': minor
'@atproto/lexicon': minor
'@atproto/lexicon-resolver': minor
'@atproto/oauth-client': minor
'@atproto/oauth-client-browser': minor
'@atproto/oauth-client-browser-example': minor
'@atproto/oauth-client-expo': minor
'@atproto/oauth-client-node': minor
'@atproto/oauth-provider': minor
'@atproto/oauth-provider-api': minor
'@atproto/oauth-provider-ui': minor
'@atproto/oauth-scopes': minor
'@atproto/oauth-types': minor
'@atproto/repo': minor
'@atproto/sync': minor
'@atproto/syntax': minor
'@atproto/tap': minor
'@atproto/ws-client': minor
'@atproto/xrpc': minor
'@atproto/xrpc-server': minor
'@atproto-labs/did-resolver': minor
'@atproto-labs/fetch': minor
'@atproto-labs/fetch-node': minor
'@atproto-labs/handle-resolver': minor
'@atproto-labs/handle-resolver-node': minor
'@atproto-labs/identity-resolver': minor
'@atproto-labs/pipe': minor
'@atproto-labs/rollup-plugin-bundle-manifest': minor
'@atproto-labs/simple-store': minor
'@atproto-labs/simple-store-memory': minor
'@atproto-labs/simple-store-redis': minor
'@atproto-labs/xrpc-utils': minor
---

Drop support for Node.js 18 and 20. Node.js 22 is now the minimum supported version. Docker images now use `node:22-alpine3.23`.

`@atproto-labs/fetch-node`: `unicastFetchWrap` and `safeFetchWrap` no longer accept `dangerouslyForceKeepAliveAgent` — on Node.js 22+ the keep-alive dispatcher is always used via `new Request(input, { dispatcher })`, so the option was a no-op.
