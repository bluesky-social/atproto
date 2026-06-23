---
name: lex-sdk
description: >
  Use this skill whenever code interacts with the `@atproto/lex` SDK family.
  This family covers `@atproto/lex` and its companion packages:
  `@atproto/lex-client`, `@atproto/lex-data`, `@atproto/lex-json`, and
  `@atproto/lex-schema` (all re-exported by `@atproto/lex`), plus
  `@atproto/lex-cbor` and `@atproto/xrpc-server` (related companion packages
  that must be imported directly — they are NOT re-exported by `@atproto/lex`).
  Trigger on ANY of the following (OR logic — match any one):
  (1) XRPC calls with `Client`, `xrpc`, or `xrpcSafe`;
  (2) defining XRPC server routes (`createServer`, `server.add`);
  (3) validating lexicon-derived data (`$build`, `$matches`, `$isTypeOf`,
  `$parse`, `$safeParse`, `$validate`);
  (4) processing AT Protocol data: JSON ↔ Lex with `lexParse` / `lexStringify` /
  `jsonToLex` / `lexToJson`, or CBOR via the separate `@atproto/lex-cbor` package;
  (5) installing or building lexicons (`lex install`, `lex build`);
  (6) working with branded strings (`DidString`, `HandleString`, `AtUriString`,
  `Cid`, `DatetimeString`);
  (7) handling blobs (`BlobRef`, `TypedBlobRef`, `LegacyBlobRef`);
  (8) migrating a package from the legacy `@atproto/api` / `@atproto/lexicon` /
  `@atproto/xrpc` / `@atproto/lex-cli` stack to `@atproto/lex` ("lexification").
  (9) replacement for zod/joi/ajv validation libraries, in projects that already
  require `@atproto/lex`.
  When a task matches multiple triggers, consult all corresponding references
  in the routing table below before responding.
disable-model-invocation: false
---

# `@atproto/lex` SDK

`@atproto/lex` is the type-safe Lexicon SDK for AT Protocol. It generates
TypeScript schemas from Lexicon JSON, validates and builds data at runtime,
and provides an XRPC client + helpers for building services.

This skill is split into focused references. Read the ones relevant to the
current task — they are self-contained. If the task involves more than one
concern (e.g., migrating a client that also uses CBOR, or both server routes
and data validation), read **all** references whose Task column matches; when
in doubt, prefer reading more references over fewer. If a referenced `.md`
file is unavailable or cannot be read, state which file is missing and respond
using only the information in this SKILL.md and general AT Protocol knowledge,
noting the limitation explicitly.

## When to read which reference

| Reference                                                                | Task                                                                                                                                                                              |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [references/setup.md](./references/setup.md)                             | Install lexicons, configure `lex build`, set up scripts/gitignore                                                                                                                 |
| [references/schemas.md](./references/schemas.md)                         | Use generated schemas: `$build`, `$matches`, `$isTypeOf`, `$parse`, `$safeParse`, `$validate`, `$type`, `$lxm`, `$Params`, `$Output`. Create custom schemas with the `l` builder. |
| [references/data-model.md](./references/data-model.md)                   | Work with AT Proto data: `LexValue`, `Cid`, `BlobRef`, JSON ↔ Lex, CBOR, datetime, branded strings (`DidString`, `HandleString`, `AtUriString`, …), `graphemeLen`/`utf8Len`      |
| [references/xrpc.md](./references/xrpc.md)                               | Make low-level XRPC calls with `xrpc()` / `xrpcSafe()`, handle `XrpcResponseError` / `XrpcInvalidResponseError` / `XrpcInternalError`                                             |
| [references/client.md](./references/client.md)                           | Use the `Client` class: auth, `call`/`create`/`get`/`put`/`delete`/`list`/`applyWrites`, labelers, Actions, service proxy                                                         |
| [references/server.md](./references/server.md)                           | Define XRPC server routes with `@atproto/xrpc-server` (`createServer`, `server.add`, handler shape)                                                                               |
| [references/lexification-server.md](./references/lexification-server.md) | Migrate **service / server** code from the legacy stack (old `src/lexicon/`, `ids.*`, `Server` from generated code, `server.app.bsky.…()` chains)                                 |
| [references/lexification-client.md](./references/lexification-client.md) | Migrate **client / consumer** code from the legacy stack (`AtpAgent` → `Client`, `.data` → `.body`, `XRPCError` → `XrpcError`, `jsonStringToLex` → `lexParse`, etc.)              |

## Top-level package layout

The `@atproto/lex` SDK family is split into two groups:

- **Re-exported sub-packages**: `@atproto/lex-client`, `@atproto/lex-schema`,
  `@atproto/lex-data`, `@atproto/lex-json`. Importing from either
  `@atproto/lex` or the sub-package path works.
- **Companion packages (NOT re-exported)**: `@atproto/lex-cbor` and
  `@atproto/xrpc-server`. These are part of the SDK family and trigger this
  skill, but they must be imported directly from their own package paths —
  never from `@atproto/lex`.

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

## Related skills

When writing or migrating tests for code that uses `@atproto/lex`, also see the [testing skill](../testing/SKILL.md) — it covers runner choice (vitest vs jest), test file location, and tsconfig setup.
