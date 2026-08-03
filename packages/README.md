# Packages

Every package in this directory is published to npm. Packages under [`./internal/`](./internal/) are published under the `@atproto-labs/*` scope; all others use `@atproto/*`. Thin runtime wrappers for the services live in [`../services/`](../services/).

## Services

- [`pds`](./pds): The Personal Data Server (PDS) — account management, repo storage, blob storage, and OAuth provider. atproto's main server-side implementation.
- [`bsky`](./bsky): The `app.bsky.*` AppView — read-side service for timelines, profiles, feed generators, and view hydration.
- [`bsync`](./bsync): Cross-AppView synchronization service (mutes, notifications) over Connect-RPC.
- [`ozone`](./ozone): Moderation service implementing the `tools.ozone.*` API.

## Lexicon SDK

The modern, type-safe Lexicon toolchain. Most consumers only need [`@atproto/lex`](./lex/lex), which re-exports the core pieces.

- [`lex`](./lex/lex): The umbrella SDK — `lex install` / `lex build` CLI, typed XRPC client, and re-exports of the packages below.
- [`lex-schema`](./lex/lex-schema): The runtime schema system that generated code is built on.
- [`lex-builder`](./lex/lex-builder): Generates TypeScript schemas from Lexicon documents.
- [`lex-document`](./lex/lex-document): Validation of Lexicon documents themselves.
- [`lex-installer`](./lex/lex-installer): Resolves and installs Lexicon documents into a project.
- [`lex-resolver`](./lex/lex-resolver): Resolves Lexicon documents from the network.
- [`lex-data`](./lex/lex-data): Core data-model types and utilities.
- [`lex-json`](./lex/lex-json): JSON encoding/decoding of Lexicon data.
- [`lex-cbor`](./lex/lex-cbor): CBOR (DRISL) encoding/decoding of Lexicon data.
- [`lex-client`](./lex/lex-client): HTTP (XRPC) client for Lexicon-defined APIs.
- [`lex-server`](./lex/lex-server): Request router for Lexicon-defined APIs.
- [`lex-password-session`](./lex/lex-password-session): Password-based client authentication, for scripts and bots.
- [`xrpc-server`](./xrpc-server): Express-based XRPC server. `server.add()` registers routes from generated lexicon schemas; used by all four services in this repo.

## OAuth

- [`oauth-provider`](./oauth/oauth-provider): OAuth 2.1 provider, as used by the PDS.
- [`oauth-provider-api`](./oauth/oauth-provider-api): Shared types between the OAuth provider and its UI.
- [`oauth-provider-ui`](./oauth/oauth-provider-ui): Sign-in and sign-up interface for the OAuth provider.
- [`oauth-client`](./oauth/oauth-client): Runtime-agnostic OAuth client base.
- [`oauth-client-browser`](./oauth/oauth-client-browser): OAuth client for browsers (WebCrypto + IndexedDB).
- [`oauth-client-node`](./oauth/oauth-client-node): OAuth client for Node.js.
- [`oauth-client-expo`](./oauth/oauth-client-expo): OAuth client for Expo applications.
- [`oauth-client-browser-example`](./oauth/oauth-client-browser-example): Example single-page app using atproto OAuth.
- [`oauth-types`](./oauth/oauth-types): OAuth typing and validation.
- [`oauth-scopes`](./oauth/oauth-scopes): Manipulation and validation of atproto OAuth scopes.
- [`jwk`](./oauth/jwk): JSON Web Key abstractions, extended by the implementations below.
- [`jwk-jose`](./oauth/jwk-jose): `jose`-backed implementation of `@atproto/jwk`.
- [`jwk-webcrypto`](./oauth/jwk-webcrypto): WebCrypto-backed implementation of `@atproto/jwk`.

## Protocol libraries

- [`syntax`](./syntax): Identifier and string-format validation: DID, handle, NSID, AT URI, TID, record key, datetime.
- [`did`](./did): DID parsing, resolution, and verification.
- [`identity`](./identity): Decentralized identity resolution combining DIDs and handles.
- [`crypto`](./crypto): Cryptographic keys and signing.
- [`repo`](./repo): The atproto repository implementation (a Merkle Search Tree) and CAR handling.
- [`sync`](./sync): Firehose consumption and repo synchronization.
- [`tap`](./tap): Client for the atproto tap (event stream) interface.
- [`ws-client`](./ws-client): Long-lived WebSocket client connections.
- [`lexicon-resolver`](./lexicon-resolver): Network resolution of Lexicon documents.

## Earlier client and schema stack

Being replaced by the Lexicon SDK above. Still used in parts of this repo; prefer `@atproto/lex` for new code.

- [`api`](./api): Client library for atproto and Bluesky.
- [`lexicon`](./lexicon): The original Lexicon schema language and validation library.
- [`xrpc`](./xrpc): XRPC client implementation.
- [`lex-cli`](./lex-cli): Codegen tool for the `@atproto/api` / `@atproto/lexicon` stack.

## Shared internals

Utility packages published under the `@atproto-labs/*` scope, all located in [`./internal/`](./internal/).

- [`fetch`](./internal/fetch): Isomorphic wrappers around the `fetch` API.
- [`fetch-node`](./internal/fetch-node): SSRF protection for `fetch()` in Node.js.
- [`pipe`](./internal/pipe): Composition of multiple functions into one.
- [`did-resolver`](./internal/did-resolver): DID resolution and verification.
- [`handle-resolver`](./internal/handle-resolver): Isomorphic handle-to-DID resolution.
- [`handle-resolver-node`](./internal/handle-resolver-node): Node-specific handle-to-DID resolution.
- [`identity-resolver`](./internal/identity-resolver): Full atproto identity resolution.
- [`simple-store`](./internal/simple-store): Minimal key-value store interfaces and utilities.
- [`simple-store-memory`](./internal/simple-store-memory): In-memory `SimpleStore`.
- [`simple-store-redis`](./internal/simple-store-redis): Redis-backed `SimpleStore`.
- [`xrpc-utils`](./internal/xrpc-utils): XRPC server utilities for Node.js.
- [`rolldown-plugin-bundle-manifest`](./internal/rolldown-plugin-bundle-manifest): Generates a manifest of bundled files from a Rolldown build.

A few further shared libraries live at the top level under the `@atproto/*` scope:

- [`common`](./common): Code shared between atproto packages (Node-friendly).
- [`common-web`](./common-web): The web-platform-friendly subset of `common`.
- [`aws`](./aws): AWS helpers (S3 blob storage, etc.) for atproto services.

## Development tooling

- [`dev-env`](./dev-env): Boots a full PDS + AppView + bsync + PLC + Ozone constellation in-process, for tests and the `make run-dev-env` REPL.
- [`dev-infra`](./dev-infra): Docker Compose definitions for the backing services (Postgres, Redis, etc.) used by tests.
