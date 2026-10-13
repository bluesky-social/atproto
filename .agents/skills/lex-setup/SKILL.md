---
name: lex-setup
description: >
  Wire up, maintain, or troubleshoot `@atproto/lex` code generation and the
  per-package `lexicons.json` manifest. Use when a package needs generated
  Lexicon schemas; when adding or editing a `lexicons.json`, its `resolvers`
  (`directory` / `http` / `repo`) or a `lexicons-overrides` directory; when
  migrating a package off compiling the repo-root `lexicons` directory; when
  adding a `codegen:lex` / `lex:install` / `prebuild` script; when `./src/lexicons/`
  or `./lexicons/` is missing, stale, or gitignored wrong; after editing anything
  under `lexicons/`; when adding an NSID; when `pnpm codegen`, `lex build`, or
  `lex install` fails; when `lex` resolves to the wrong binary; when a
  post-lexicon-edit build reports "type X is not assignable to Y"; or when ripping
  out legacy `@atproto/lex-cli` codegen. Reach for it before hand-editing anything
  under a `lexicons/`, `lexicons-overrides/`, or `src/lexicons/` directory, or any
  `lexicons.json`.
disable-model-invocation: false
---

# `@atproto/lex` codegen setup

Two commands do everything:

- **`lex build`** — compiles Lexicon JSON into a TypeScript schema tree. Every
  package that uses `@atproto/lex` runs this.
- **`lex install`** — resolves the Lexicons a package's `lexicons.json` lists
  into `./lexicons/`, recording each one's source + CID, from the manifest's
  `resolvers` and the network.

Both ship in the `lex` bin of `@atproto/lex`. Add `@atproto/lex` as a
dependency — it re-exports `@atproto/lex-client`, `-schema`, `-data`, and
`-json`, so one dependency covers the common case. `@atproto/lex-cbor` is
_not_ re-exported; depend on it directly if the package encodes/decodes CBOR.

## Wiring a package in this monorepo

[lexicons/](../../../lexicons/) at the repo root is the canonical source for the
`com.atproto` and `tools.ozone` namespaces **only**. Every package manages its
Lexicons through its own committed `lexicons.json` manifest and resolves them
with `lex install` — no package compiles the root directory directly (the one
exception is [packages/lex/lex-resolver](../../../packages/lex/lex-resolver/package.json),
which can't depend on the installer; see
[Packages under `packages/lex/`](#packages-under-packageslex)). The manifest's
`resolvers` decide where each NSID comes from; see
[Manifest resolvers](#manifest-resolvers-lexiconsjson).

Copy the shape consuming packages use
([packages/pds](../../../packages/pds/package.json),
[packages/sync](../../../packages/sync/package.json),
[packages/bsky](../../../packages/bsky/package.json)):

```json
{
  "scripts": {
    // Generate TypeScript schema from Lexicon JSON
    "lex:build": "lex build --clear --indexFile",
    // Install Lexicon JSON into ./lexicons/ and update the manifest. Use `pnpm lex:install foo.bar.baz` to install new lexicons
    "lex:install": "lex install",
    // Keep the TypeScript schema up to date after installing new lexicons
    "postlex:install": "pnpm run lex:build",
    // Allows to keep the manifest.json up-to-date when a canonical lexicon is updated. Also allows to fetch new lexicons from the network.
    "lex:update": "lex update",
    // Run the build step after updating the lexicons
    "postlex:update": "pnpm run lex:build",
    // When performing a regular build (eg. from CI), ensure that the lexicons are installed and match the manifest.
    "codegen:lex": "pnpm run lex:install --ci",
    "prebuild": "pnpm run '/^(codegen:.+)$/'",
    "build": "tsc --build tsconfig.build.json"
  }
}
```

Then gitignore the build artifacts. The generated TypeScript (`src/lexicons`) is
never committed. Under `./lexicons`, the rebuildable trees are gitignored too —
the symlinked canonical set and anything fetched from a pinned source (e.g. the
`app.bsky.*` / `chat.bsky.*` GitHub `http` resolver) — while `at://` network
copies stay committed for offline builds (the network can't serve old versions)
and `./lexicons-overrides` is always committed. See
[packages/bsky/.gitignore](../../../packages/bsky/.gitignore) for the shape:

```
# @atproto/lex
src/lexicons
# symlinked-canonical + GitHub-fetched: rebuildable, not committed
lexicons/com/atproto
lexicons/tools/ozone
lexicons/app/bsky
lexicons/chat/bsky
```

A package whose Lexicons are *all* symlinked canonical (e.g.
[packages/sync](../../../packages/sync/package.json)) can gitignore the whole
`/lexicons` tree instead.

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
and resolution is per-package. In `packages/api` — which still depends on
`lex-cli` for `gen-api` — `pnpm exec lex` gives you the **legacy** CLI, not
`lex build`. `api` therefore installs its manifest with the `lex-installer`
bin (`@atproto/lex-installer`) and feeds the installed `./lexicons` to
`gen-api`. Everywhere else `lex` is `@atproto/lex`.

If a `lex build` invocation errors about an unknown command, that collision is
why. `@atproto/lex` also registers `ts-lex`, which is unambiguous. Outside a
workspace, `npx @atproto/lex` avoids pulling the unrelated unscoped `lex`
package that bare `npx lex` would fetch.

### Manifest resolvers (`lexicons.json`)

The manifest's `lexicons` array lists the NSID **entry points** the package
needs; `lex install` pulls in schemas they reference transitively, so you only
list the roots. `resolvers` is an **ordered** list deciding where each NSID is
fetched from — earlier entries win, with the AT Protocol network as the implicit
last fallback. The kinds:

- `{ "type": "directory", "path": "../../lexicons", "include": ["com.atproto.*", "tools.ozone.*"] }`
  — resolve from a local directory. The canonical set lives at the repo root;
  matches are **symlinked** into `./lexicons` and locked with a `file://` URI, so
  they can't drift. Adjust `path` for the package's depth.
- `{ "type": "http", "base": "https://raw.githubusercontent.com/bluesky-social/bsky/refs/heads/main/lexicons/", "include": ["app.bsky.*", "chat.bsky.*"] }`
  — fetch `<base>/<…nsid.segments>.json` (e.g. a raw Git host). `http` falls
  through on 404 but throws on other errors.
- `{ "type": "repo", "repo": "<handle|did>" }` — resolve each NSID from that
  repo's `com.atproto.lexicon.schema` records; never falls through.
- A `directory` resolver pointing at a committed **`./lexicons-overrides`** dir,
  listed **first** so it takes precedence. Put any document that must differ from
  what the other resolvers return here: unpublished NSIDs (`internal.*`,
  `place.stream.badge.defs`, a not-yet-published `app.bsky.unspecced.*`) and
  documents whose local version is ahead of the published one. Copy the file in
  from the root `lexicons`; it is committed, unlike the gitignored resolved set.

[packages/bsky/lexicons.json](../../../packages/bsky/lexicons.json) is the full
reference (overrides + canonical directory + GitHub `http`).

`include`/`exclude` globs accept `*` as a wildcard; `exclude` is applied after
`include`.

### Packages under `packages/lex/`

`@atproto/lex` depends on the SDK sub-packages, so they cannot depend back on it
(it would be circular). They generate with `@atproto/lex-builder`'s `lex-builder
build --lib @atproto/lex-schema` (that is where the generated files import `l`
from) instead of `lex build`, and install their manifest with `@atproto/lex-installer`'s
`lex-installer install` instead of `lex install`:

```jsonc
"lex:build": "lex-builder build --out ./src/lexicons --clear --lib @atproto/lex-schema --index-file",
"lex:install": "lex-installer install",
"postlex:install": "pnpm run lex:build",
"codegen:lex": "pnpm run lex:install --ci",
```

See [packages/lex/lex-password-session](../../../packages/lex/lex-password-session/package.json).
Add `--default-export` to `lex:build` for a browser-facing client
([packages/lex/lex-client](../../../packages/lex/lex-client/package.json)).

One carve-out: a package that is itself inside `@atproto/lex-installer`'s
dependency tree can't depend on the installer. Today that is
[packages/lex/lex-resolver](../../../packages/lex/lex-resolver/package.json),
which keeps the older `lex-builder build --lexicons ../../../lexicons --include …`
form and compiles the canonical root directly.

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

Adding a new external NSID means listing it in the package's `lexicons.json`
`lexicons` array (or `pnpm lex:install <nsid>`), then re-running codegen. A new
canonical (`com.atproto.*` / `tools.ozone.*`) schema is added at the repo root
and picked up by each dependent package's next `lex:install`; run
`pnpm lex:update-local` from the root to propagate a changed canonical CID into
every manifest.

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

Don't commit a second **copy** of schemas that already live in
[lexicons/](../../../lexicons/) — it would silently diverge. In-repo, vendor by
**symlink** instead (next section), which can't drift.

## Vendoring the canonical lexicons (in-repo)

Consuming [lexicons/](../../../lexicons/) through `lex install` (rather than
compiling it directly) is the standard setup — it makes a package's lexicon set
an explicit, CID-locked contract. A `directory` resolver resolves each canonical
NSID from the root; those resolutions are **symlinked** into `./lexicons/` (not
copied) and locked with a `file://` URI relative to the manifest, so they can't
diverge. [packages/pds](../../../packages/pds/package.json) is the reference:

```jsonc
// lexicons.json (committed) — roots + resolvers + CID locks
{
  "version": 2,
  "lexicons": ["com.atproto.repo.getRecord", "…every vendored NSID…"],
  "resolvers": [
    { "type": "directory", "path": "../../lexicons", "include": ["com.atproto.*", "tools.ozone.*"] }
  ],
  "resolutions": {
    "com.atproto.repo.getRecord": {
      "uri": "file://../../lexicons/com/atproto/repo/getRecord.json",
      "cid": "…",
    },
  },
}
```

```jsonc
// package.json — install (creating symlinks + verifying the lock), then build
"codegen:lex": "pnpm run lex:install --ci",
"lex:install": "lex install",     // regenerate the manifest after adding/removing a lexicon
"postlex:install": "pnpm run lex:build",
"lex:build": "lex build --clear --indexFile",
```

Gitignore the symlinked `/lexicons` tree (a build artifact) but **commit
`lexicons.json`** (the contract). Generate/refresh the manifest with
`pnpm run lex:install`; `--ci` then fails the build if `/lexicons` drifts from
the locked CIDs. Tradeoff: the `lexicons` roots list is explicit, so adding a
new canonical schema requires re-running `lex:install` to include it — unlike a
plain `lex build --lexicons ../../lexicons`, which picks up every file
implicitly. For the full resolver vocabulary (`directory` / `http` / `repo`,
ordering, and the `lexicons-overrides` directory) see
[Manifest resolvers](#manifest-resolvers-lexiconsjson) above.

## Removing legacy `@atproto/lex-cli` codegen

The legacy output directory depends on which generator ran — `lex gen-server`
emits `./src/lexicon` (singular), `lex gen-api` emits `./src/client`. Both are
fully generated and safe to delete. Leave `lexicons/` alone; it is input, not
output.

Then drop `@atproto/lex-cli` from `devDependencies`, add a `lexicons.json`
(resolving the canonical set from the root plus whatever external namespaces the
package used), replace the old `codegen:lex` with the `lex:install` / `lex:build`
form above, and repoint `.gitignore` at `src/lexicons` plus the rebuildable
`/lexicons` trees. (`packages/api` is the exception — it keeps `gen-api` but now
feeds it a locally-installed `./lexicons`; see
[Which `lex` binary you get](#which-lex-binary-you-get).)

## Related skills

Once the package generates code: [lex-schema](../lex-schema/SKILL.md)
(`$`-accessors, validation), [lex-data](../lex-data/SKILL.md) (values, blobs,
CBOR, branded strings), [lex-client](../lex-client/SKILL.md) (calling out),
[xrpc-server](../xrpc-server/SKILL.md) (defining routes), and
[lexification-client](../lexification-client/SKILL.md) /
[lexification-server](../lexification-server/SKILL.md) (migrating off the
legacy stack).
