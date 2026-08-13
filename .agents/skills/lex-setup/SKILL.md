---
name: lex-setup
description: >
  Wire up, maintain, or troubleshoot `@atproto/lex` code generation for a
  package. Use when a package needs generated Lexicon schemas, when adding a
  `codegen:lex` / `prebuild` script, when `./src/lexicons/` is missing, stale,
  or gitignored wrong, after editing anything under `lexicons/`, when adding an
  NSID or an `--include` filter, when `pnpm codegen` or `lex build` fails, when
  `lex` resolves to the wrong binary, when a post-lexicon-edit build reports
  "type X is not assignable to Y", or when ripping out legacy `@atproto/lex-cli`
  codegen. Reach for it before hand-editing anything under a `lexicons/` or
  `src/lexicons/` directory.
disable-model-invocation: false
---

# `@atproto/lex` codegen setup

Two commands do everything:

- **`lex build`** — compiles Lexicon JSON into a TypeScript schema tree. Every
  package that uses `@atproto/lex` runs this.
- **`lex install`** — fetches Lexicon JSON from the Atmosphere network into
  `./lexicons/` plus a `lexicons.json` manifest. **No package in this monorepo
  uses it** (see [Network-installed schemas](#network-installed-schemas-outside-this-repo)).

Both ship in the `lex` bin of `@atproto/lex`. Add `@atproto/lex` as a
dependency — it re-exports `@atproto/lex-client`, `-schema`, `-data`, and
`-json`, so one dependency covers the common case. `@atproto/lex-cbor` is
_not_ re-exported; depend on it directly if the package encodes/decodes CBOR.

## Wiring a package in this monorepo

[lexicons/](../../../lexicons/) at the repo root is the canonical source. There
is no manifest, no `lex install`, and no `postinstall` hook anywhere here —
schemas are committed source, so there is nothing to fetch or verify.

Copy the shape every consuming package already uses
([packages/bsky](../../../packages/bsky/package.json),
[packages/pds](../../../packages/pds/package.json),
[packages/sync](../../../packages/sync/package.json)):

```json
{
  "scripts": {
    "codegen:lex": "lex build --clear --indexFile --lexicons ../../lexicons",
    "prebuild": "pnpm run '/^(codegen:.+)$/'",
    "build": "tsgo --build tsconfig.build.json"
  }
}
```

Adjust `../../lexicons` for the package's depth. Compile with `tsgo`, not
`tsc` — there is no per-package `typescript` devDependency in this repo. Then
gitignore the output, since generated files are build artifacts, not source:

```
# @atproto/lex
src/lexicons
```

The indirection through `codegen:lex` is deliberate:

- `prebuild` runs every `codegen:*` script the package declares, so a package
  that also generates protobuf or templates needs no change to this line.
  `enable-pre-post-scripts = true` in `.npmrc` is what makes a build fire
  `prebuild` at all.
- Root `pnpm codegen` runs `build:tooling` and then every `codegen:*` script
  across the workspace in parallel. A generator hidden inside `prebuild` would
  be skipped by it.

### Which `lex` binary you get

`@atproto/lex-cli` (legacy) and `@atproto/lex` both claim the `lex` bin name,
and resolution is per-package. In `packages/api` and `packages/ozone` — which
still depend on `lex-cli` — `pnpm exec lex` gives you the **legacy** CLI
(`gen-api` / `gen-server`), not `lex build`. Everywhere else it is
`@atproto/lex`.

If a `lex build` invocation errors about an unknown command, that collision is
why. `@atproto/lex` also registers `ts-lex`, which is unambiguous. Outside a
workspace, `npx @atproto/lex` avoids pulling the unrelated unscoped `lex`
package that bare `npx lex` would fetch.

### Narrow packages: `--include`

Compiling all of `lexicons/` into a small library is wasteful. Filter by NSID —
schemas referenced by an included document are pulled in transitively, so only
the entry points need listing:

```jsonc
"codegen:lex": "lex build --clear --indexFile --lexicons ../../lexicons --include com.atproto.sync.subscribeRepos"
```

Patterns accept `*` as a wildcard (`app.bsky.*`); `--exclude` is applied after
`--include`.

### Packages under `packages/lex/`

`@atproto/lex` depends on the SDK sub-packages, so they cannot depend back on
it. They generate with `--lib @atproto/lex-schema` instead, which is what the
generated files then import `l` from.

When the flags get unwieldy (long include lists, or two output trees), those
packages call the builder API directly from a `scripts/lex-build.js` and keep
`"codegen:lex": "node ./scripts/lex-build.js"` — see
[packages/lex/lex-client/scripts/lex-build.js](../../../packages/lex/lex-client/scripts/lex-build.js).
`build()` from `@atproto/lex-builder` takes the same options in camelCase.

## `lex build` flags

Defaults: `--lexicons ./lexicons`, `--out ./src/lexicons`, `--pretty`,
`--default-export`. yargs accepts either kebab-case or camelCase
(`--index-file` == `--indexFile`).

- `--clear` — wipe the output dir first, so deleted lexicons don't linger
- `--override` — overwrite existing files (no-op alongside `--clear`)
- `--indexFile` — emit `index.ts` re-exporting root namespaces (`app`, `com`, …)
- `--include` / `--exclude <patterns…>` — filter by NSID
- `--lib <package>` — where generated files import `l` from
- `--importExt <ext>` — import specifier extension (`.js`; `""` for extensionless)
- `--fileExt <ext>` — emitted file extension (`.ts`)
- `--no-pretty` — skip prettier
- `--no-defaultExport` — drop `default` re-exports (see [Tree-shaking](#tree-shaking))
- `--defsExport` — also expose defs under `$defs`, for when a child namespace
  shadows a sibling definition (`com.example.foo` vs `com.example.foo.bar`)
- `--ignore-errors` / `--ignore-invalid-lexicons` — skip bad inputs instead of failing

## Using the generated tree

`--indexFile` gives one entry point for all root namespaces; schemas are
addressed by NSID dot-path:

```ts
import { app, com, chat } from '../lexicons/index.js'

app.bsky.feed.post // record schema
app.bsky.feed.defs.postView // object def
com.atproto.repo.getRecord // query/procedure schema
```

Each NSID compiles to a `<name>.defs.ts` holding the schema plus a thin
`<name>.ts` re-exporting it (and `main` as `default`). Nothing under
`src/lexicons/` is hand-editable — it is deleted and rewritten on every
`--clear` build.

### Tree-shaking

The generated tree is tree-shakeable, but the reference style decides how much
survives. A bundler can't tell that `client.call()` only consumes `.main`, so
naming the namespace retains every sibling def inside it:

```ts
// Smallest — default import; preferred for browser bundles
import getRecord from '../lexicons/com/atproto/repo/getRecord.js'
await client.call(getRecord, {})

// Same size, but leaks the `main` identifier into your source
import { main as getRecord } from '../lexicons/com/atproto/repo/getRecord.js'
await client.call(com.atproto.repo.getRecord.main, {})

// Largest — namespace notation drags in sibling defs
await client.call(com.atproto.repo.getRecord, {})
```

Services, scripts, and tests here use namespace notation, which reads closest
to the NSID and costs nothing server-side. Libraries and browser apps should
prefer the default import.

## After editing lexicon JSON

Generated TypeScript is not rebuilt automatically. Regenerate before building
or testing anything downstream — a stale tree is by far the most common cause
of "type X is not assignable to Y" right after a lexicon edit:

```bash
pnpm codegen        # repo root: every codegen:* script in the workspace
pnpm run prebuild   # inside one package
```

`pnpm codegen` builds `@atproto/lex-builder` first via `build:tooling`. If
codegen output still looks stale, that build is the thing to re-run.

`packages/api` and `packages/ozone` guard their codegen behind an mtime check
against `lexicons/`, so they can appear to skip regeneration; run their
`codegen:lex` directly if you suspect that.

Adding a new NSID needs no configuration — it appears under the matching
namespace path on the next build, unless an `--include` filter excludes it.

## Network-installed schemas (outside this repo)

For a package whose Lexicons are _not_ maintained alongside it, `lex install`
fetches them from the network into `./lexicons/` and records each resolution
(AT URI + CID) in `./lexicons.json`.

```bash
lex install app.bsky.feed.post   # add NSIDs; dependencies resolve automatically
lex install                      # install everything the manifest lists
lex install --update             # re-resolve all to latest
lex install --ci                 # fail if installed files drift from manifest CIDs
lex install --no-save <nsid>     # install without touching the manifest
```

Flags: `--manifest <path>` (default `./lexicons.json`), `--lexicons <dir>`
(default `./lexicons`), `--update`, `--ci`, `--no-save`.

Commit both the manifest and the fetched JSON — they are the input contract,
and the recorded CIDs are what makes `--ci` meaningful. The upstream-recommended
wiring adds `"postinstall": "lex install --ci"` to catch drift on every install
and `"update-lexicons": "lex install --update"` as the deliberate refresh.

Don't introduce this in this monorepo: a second copy of schemas that already
live in [lexicons/](../../../lexicons/) would silently diverge from the
canonical ones.

## Removing legacy `@atproto/lex-cli` codegen

The legacy output directory depends on which generator ran — `lex gen-server`
emits `./src/lexicon` (singular), `lex gen-api` emits `./src/client`. Both are
fully generated and safe to delete. Leave `lexicons/` alone; it is input, not
output.

Then drop `@atproto/lex-cli` from `devDependencies`, replace the old
`codegen:lex` script with the `lex build` form above, and repoint `.gitignore`
at `src/lexicons`.

## Related skills

Once the package generates code: [lex-schema](../lex-schema/SKILL.md)
(`$`-accessors, validation), [lex-data](../lex-data/SKILL.md) (values, blobs,
CBOR, branded strings), [lex-client](../lex-client/SKILL.md) (calling out),
[xrpc-server](../xrpc-server/SKILL.md) (defining routes), and
[lexification-client](../lexification-client/SKILL.md) /
[lexification-server](../lexification-server/SKILL.md) (migrating off the
legacy stack).
