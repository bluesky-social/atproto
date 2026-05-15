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

Convert to pure ESM. All packages now ship `"type": "module"` with ES module output and Node16 module resolution.

Node.js 22's `require()` compatibility layer can still load these packages in CommonJS code. However, direct CJS consumers on older Node versions will need to use dynamic `import()`.

Also upgrades:
- `multiformats` ^9 → ^13
- `uint8arrays` 3 → ^5
- `p-queue` ^6 → ^8
- `jose` ^4 → ^5 (in xrpc-server)

Service entrypoints converted from JavaScript to TypeScript, using Node 22's type stripping for direct `.ts` execution.
