---
name: lex-setup
description: >
  Set up or maintain `@atproto/lex` codegen in a package. Trigger on:
  `lex install` / `lex build` / `lex install --ci`, the `lexicons.json` or
  `manifest.json` manifest, adding or updating an NSID, editing lexicon JSON
  and needing regeneration, wiring `prebuild` / `postinstall` / `codegen`
  scripts, gitignoring `src/lexicons/`, tree-shaking generated code, or stale
  codegen errors ("type X is not assignable to Y" after a lexicon edit).
disable-model-invocation: false
---

# Setting up `@atproto/lex` in a package

`@atproto/lex` is the type-safe Lexicon SDK for AT Protocol. It generates
TypeScript schemas from Lexicon JSON, validates and builds data at runtime,
and provides an XRPC client + helpers for building services.

Two CLI commands drive everything: `lex install` (fetch schemas) and
`lex build` (generate TypeScript). The `lex` binary ships with `@atproto/lex`.

> [!NOTE]
> Some systems already have a `lex` binary. Use `pnpm exec lex`, `npx lex`,
> or `ts-lex` if it conflicts.

## Package layout

The SDK family is split into two groups:

- **Re-exported sub-packages**: `@atproto/lex-client`, `@atproto/lex-schema`,
  `@atproto/lex-data`, `@atproto/lex-json`. Importing from either
  `@atproto/lex` or the sub-package path works.
- **Companion package (NOT re-exported)**: `@atproto/lex-cbor`. Import it
  directly from its own package path — never from `@atproto/lex`.

| Sub-package           | Provides                                                                                                                                                                                                             |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@atproto/lex-client` | `Client`, `xrpc`, `xrpcSafe`, `XrpcResponseError`, `XrpcInvalidResponseError`, `XrpcInternalError`, `XrpcResponseValidationError`                                                                                    |
| `@atproto/lex-schema` | The `l` schema-builder namespace, `Schema` types, validation primitives                                                                                                                                              |
| `@atproto/lex-data`   | `LexValue`, `LexMap`, `Cid`, `parseCid`, `BlobRef`, `TypedBlobRef`, `LegacyBlobRef`, branded strings (`DidString`, `HandleString`, `AtUriString`, `DatetimeString`, …), `graphemeLen`, `utf8Len`, `isLanguageString` |
| `@atproto/lex-json`   | `lexParse`, `lexStringify`, `jsonToLex`, `lexToJson`, `parseLexLink`, `encodeLexLink`, `parseLexBytes`, `encodeLexBytes`                                                                                             |
| `@atproto/lex-cbor`   | CBOR `encode` / `decode` (separate package, not re-exported by `@atproto/lex`)                                                                                                                                       |

Add `@atproto/lex` as a dependency; add `@atproto/lex-cbor` separately if the
package encodes or decodes CBOR.

## 1. Install lexicon JSON schemas

`lex install` fetches Lexicon documents from the Atmosphere network into
`./lexicons/` and tracks them in a manifest (`lexicons.json` by default;
some packages use `manifest.json`).

```bash
# Install specific NSIDs (and update manifest)
lex install app.bsky.feed.post app.bsky.feed.like

# Install everything listed in the manifest (no args)
lex install

# Re-fetch all installed lexicons to their latest versions
lex install --update

# CI mode: verify installed lexicons match manifest CIDs (used in postinstall)
lex install --ci

# Install without updating the manifest
lex install --no-save app.bsky.feed.post
```

Useful flags:

- `--manifest <path>` — manifest path (default `./lexicons.json`)
- `--lexicons <dir>` — output dir for JSON files (default `./lexicons`)
- `--update` — re-resolve and re-install everything
- `--ci` — error if installed lexicons drift from manifest CIDs
- `--no-save` — install without touching the manifest

**Commit `lexicons.json` and `lexicons/` to git.** The schema JSON is the
input contract.

## 2. Generate TypeScript schemas

`lex build` reads `./lexicons/` and emits a generated tree under
`./src/lexicons/` (plural).

```bash
lex build --lexicons ./lexicons --clear --indexFile
```

Useful flags:

- `--lexicons <dir>` — input JSON dir (default `./lexicons`)
- `--out <dir>` — output dir (default `./src/lexicons`)
- `--clear` — wipe the output dir before generating (recommended)
- `--override` — overwrite existing files (no-op with `--clear`)
- `--indexFile` — emit an index re-exporting root namespaces (`app`, `com`, `chat`, …)
- `--no-pretty` — skip prettier
- `--pure-annotations` — add `/*#__PURE__*/` markers (use for libraries)
- `--exclude <patterns…>` / `--include <patterns…>` — filter by NSID
- `--lib <package>` — library to import the `l` builder from (default `@atproto/lex`)
- `--importExt <ext>` — extension for emitted imports (default `.js`; pass `""` for extensionless)
- `--fileExt <ext>` — extension for emitted files (default `.ts`)
- `--no-defaultExport` — disable `default` re-exports (see tree-shaking below)

**Gitignore the generated dir:**

```bash
echo '/src/lexicons/' >> .gitignore
```

## 3. Wire up `package.json`

Standard scripts for service packages:

```json
{
  "scripts": {
    "postinstall": "lex install --ci",
    "prebuild": "lex build --lexicons ./lexicons --clear --indexFile",
    "update-lexicons": "lex install --update --save",
    "build": "tsc --build tsconfig.build.json"
  }
}
```

Behavior:

1. `postinstall` verifies installed schemas match the manifest after every
   `npm install` / `pnpm install` / CI install.
2. `prebuild` regenerates `./src/lexicons/` before TypeScript builds.
3. `update-lexicons` is the human-driven escape hatch to refresh schemas.

## 4. Use the generated code

After `lex build`, import namespaces from the index file:

```ts
import { app, com, chat } from './lexicons/index.js'

// Schemas are addressed by NSID dot-path
app.bsky.feed.post // record schema
app.bsky.feed.defs.postView // object def
com.atproto.repo.getRecord // query/procedure schema
```

If your bundler supports it, set up a path alias (e.g. `#lexicons` →
`./src/lexicons/index.js`) to avoid long relative paths.

Directory conventions, in short:

- Lexicon JSON input lives in `./lexicons/` (singular file per NSID), with the
  manifest in `lexicons.json`. Both are committed.
- Generated TypeScript lives in `./src/lexicons/` (**plural**) — gitignored and
  regenerated by `lex build`. Never edit by hand.

## Tree-shaking

How you import a schema affects bundle size. Four styles, smallest to
largest bundle:

```ts
// Smallest — default import (recommended for browser bundles)
import getRecord from './lexicons/com/atproto/repo/getRecord.js'
await client.call(getRecord, {/* ... */})

// Same size, less ergonomic — direct named import
import { main as getRecord } from './lexicons/com/atproto/repo/getRecord.js'

// Same size, leaks `.main` — explicit main reference
import * as com from './lexicons/com.js'
await client.call(com.atproto.repo.getRecord.main, {/* ... */})

// Largest — namespace notation (drags in sibling defs)
import * as com from './lexicons/com.js'
await client.call(com.atproto.repo.getRecord, {/* ... */})
```

For services, scripts, and tests where bundle size doesn't matter, the
namespace style is fine and reads the most naturally. For libraries and
browser apps, prefer default imports.

## Adding a new NSID later

```bash
lex install com.atproto.identity.resolveHandle
pnpm run prebuild   # regenerate ./src/lexicons/
```

The new schema appears under the matching namespace path automatically.

## Editing lexicon JSON

When you change anything under a package's `./lexicons/` directory (or the
repo-wide [lexicons/](../../../lexicons/) directory consumed by services
via `--lexicons ../../lexicons`), regenerate the TS tree before building or
testing any dependent package:

```bash
pnpm codegen   # from repo root, recursive across packages
# or
pnpm run prebuild   # from a single package
```

Stale generated code is the most common source of "type X is not assignable
to Y" errors after a lexicon edit.

## Removing the legacy setup

If migrating from `@atproto/lex-cli` codegen:

```bash
rm -rf ./src/lexicon ./lexicons    # plural & singular both
lex install <nsids...>             # rebuild the manifest
```

Then remove `@atproto/lex-cli` from `devDependencies` and the old
`codegen` script that called `lex gen-server`.

## Related skills

Once the package is generating code: [lex-schemas](../lex-schemas/SKILL.md)
(`$`-accessors, validation), [lex-data-model](../lex-data-model/SKILL.md)
(values, blobs, CBOR, branded strings), [lex-client](../lex-client/SKILL.md) /
[lex-xrpc](../lex-xrpc/SKILL.md) (calls out),
[xrpc-server](../xrpc-server/SKILL.md) (defining routes), and
[lexification-client](../lexification-client/SKILL.md) /
[lexification-server](../lexification-server/SKILL.md) (migrating off the
legacy stack).
