---
name: lex-sdk
description: >
  Use this skill whenever code interacts with `@atproto/lex` (or its
  sub-packages `@atproto/lex-client`, `@atproto/lex-data`, `@atproto/lex-json`,
  `@atproto/lex-cbor`, `@atproto/lex-schema`, `@atproto/xrpc-server`). Trigger
  when the user makes XRPC calls with `Client`, `xrpc`, `xrpcSafe`, defines
  XRPC server routes (`createServer`, `server.add`), validates lexicon-derived
  data (`$build`, `$matches`, `$isTypeOf`, `$parse`, `$safeParse`,
  `$validate`), processes AT Protocol data (JSON ↔ Lex with `lexParse` /
  `lexStringify` / `jsonToLex` / `lexToJson`, CBOR with `@atproto/lex-cbor`),
  installs or builds lexicons (`lex install`, `lex build`), works with branded
  strings (`DidString`, `HandleString`, `AtUriString`, `Cid`, `DatetimeString`),
  handles blobs (`BlobRef`, `TypedBlobRef`, `LegacyBlobRef`), or migrates a
  package from the legacy `@atproto/api` / `@atproto/lexicon` / `@atproto/xrpc`
  / `@atproto/lex-cli` stack to `@atproto/lex` ("lexification").
---

# `@atproto/lex` SDK

`@atproto/lex` is the type-safe Lexicon SDK for AT Protocol. It generates
TypeScript schemas from Lexicon JSON, validates and builds data at runtime,
and provides an XRPC client + helpers for building services.

This skill is split into focused references. Read **only** the ones relevant
to the current task — they are self-contained.

## When to read which reference

| Reference                                                                | Task                                                                                                                                                                         |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [references/setup.md](./references/setup.md)                             | Install lexicons, configure `lex build`, set up scripts/gitignore                                                                                                            |
| [references/schemas.md](./references/schemas.md)                         | Use generated schemas: `$build`, `$matches`, `$isTypeOf`, `$parse`, `$safeParse`, `$validate`, `$type`, `$lxm`, `$Params`, `$Output`                                         |
| [references/data-model.md](./references/data-model.md)                   | Work with AT Proto data: `LexValue`, `Cid`, `BlobRef`, JSON ↔ Lex, CBOR, datetime, branded strings (`DidString`, `HandleString`, `AtUriString`, …), `graphemeLen`/`utf8Len` |
| [references/xrpc.md](./references/xrpc.md)                               | Make low-level XRPC calls with `xrpc()` / `xrpcSafe()`, handle `XrpcResponseError` / `XrpcInvalidResponseError` / `XrpcInternalError`                                        |
| [references/client.md](./references/client.md)                           | Use the `Client` class: auth, `call`/`create`/`get`/`put`/`delete`/`list`/`applyWrites`, labelers, Actions, service proxy                                                    |
| [references/server.md](./references/server.md)                           | Define XRPC server routes with `@atproto/xrpc-server` (`createServer`, `server.add`, handler shape)                                                                          |
| [references/lexification-server.md](./references/lexification-server.md) | Migrate **service / server** code from the legacy stack (old `src/lexicon/`, `ids.*`, `Server` from generated code, `server.app.bsky.…()` chains)                            |
| [references/lexification-client.md](./references/lexification-client.md) | Migrate **client / consumer** code from the legacy stack (`AtpAgent` → `Client`, `.data` → `.body`, `XRPCError` → `XrpcError`, `jsonStringToLex` → `lexParse`, etc.)         |

## Top-level package layout

`@atproto/lex` re-exports from these focused sub-packages — importing from
either path works:

| Sub-package            | Provides                                                                                                                                                                                                             |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@atproto/lex-client`  | `Client`, `xrpc`, `xrpcSafe`, `XrpcResponseError`, `XrpcInvalidResponseError`, `XrpcInternalError`, `XrpcResponseValidationError`                                                                                    |
| `@atproto/lex-schema`  | The `l` schema-builder namespace, `Schema` types, validation primitives                                                                                                                                              |
| `@atproto/lex-data`    | `LexValue`, `LexMap`, `Cid`, `parseCid`, `BlobRef`, `TypedBlobRef`, `LegacyBlobRef`, branded strings (`DidString`, `HandleString`, `AtUriString`, `DatetimeString`, …), `graphemeLen`, `utf8Len`, `isLanguageString` |
| `@atproto/lex-json`    | `lexParse`, `lexStringify`, `jsonToLex`, `lexToJson`, `parseLexLink`, `encodeLexLink`, `parseLexBytes`, `encodeLexBytes`                                                                                             |
| `@atproto/lex-cbor`    | CBOR `encode` / `decode` (separate package, not re-exported by `@atproto/lex`)                                                                                                                                       |
| `@atproto/xrpc-server` | `createServer`, `Server` type, `Headers` (used to define server routes — not re-exported by `@atproto/lex`)                                                                                                          |

## Generated code conventions

- Lexicon JSON lives in `./lexicons/`, manifest in `lexicons.json` (or
  `manifest.json` — both are committed).
- Generated TS lives in `./src/lexicons/` (plural — gitignored, regenerated
  by `lex build`).
- Import the namespace tree from the index: `import { app, com, chat } from './lexicons/index.js'`.
- Schemas are accessed by NSID dot-path: `app.bsky.feed.post`,
  `com.atproto.repo.getRecord`, `app.bsky.feed.defs.postView`.
