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

Build with TypeScript 6.0. Emitted `.d.ts` files now use TypeScript 6's stricter `Uint8Array<ArrayBuffer>` typing in places where Web/Node APIs require buffer-backed (not shared-memory) byte arrays. Consumers compiling against these types on older TypeScript should see no runtime impact, but may need to widen or cast in spots that previously relied on `Uint8Array` defaulting to `<ArrayBufferLike>`.

Internal: tsconfig `moduleResolution: "node"` is silenced via `ignoreDeprecations: "6.0"` for now; the proper migration to `node16`/`bundler` resolution is deferred.
