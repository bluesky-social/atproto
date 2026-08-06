# Project configuration

Read this for step 1 of the migration: replacing `lex gen-server` codegen with
`lex build`, fixing dependencies, and deleting the legacy generated tree.

`packages/ozone/package.json` is the current "before"; `packages/pds` and
`packages/bsky` are the "after".

## Scripts

Before (ozone — note the hand-maintained glob list and the staleness check):

```jsonc
"codegen:lex": "lex gen-server --yes ./src/lexicon ../../lexicons/com/atproto/*/* ../../lexicons/app/bsky/*/* ../../lexicons/chat/bsky/*/* ../../lexicons/tools/ozone/*/*",
"prebuild": "[ -f ./src/lexicon/index.ts ] && [ -z \"$(find ../../lexicons -newer ./src/lexicon/index.ts -type f -print -quit)\" ] || pnpm run codegen:lex",
```

After:

```jsonc
"codegen:lex": "lex build --clear --indexFile --lexicons ../../lexicons",
"prebuild": "pnpm run '/^(codegen:.+)$/'",
```

Two things fall out of this, both deliberate:

- No NSID list. `lex build` compiles the whole `lexicons/` tree, so adding a
  lexicon needs no `package.json` edit. (Small libraries use `--include` to
  trim output; a service that serves most of a namespace should not.)
- No staleness guard. `--clear` regenerates unconditionally and the glob
  `prebuild` picks up every `codegen:*` script the package declares, so a
  package that also generates protobuf (`bsky`) or templates (`pds`) needs no
  change to that line. Keep the name `codegen:lex` — root `pnpm codegen` runs
  `/^(codegen:.+)$/` across the workspace, and a generator hidden inside
  `prebuild` would be skipped by it.

Full flag reference: [lex-setup skill](../../lex-setup/SKILL.md).

## Dependencies

Add to `dependencies`:

- `@atproto/lex`
- `@atproto/xrpc-server` (already present in every service — verify, don't add
  blindly)

Remove:

- `@atproto/lexicon` — `dependencies`
- `@atproto/xrpc` — `dependencies`
- `multiformats` — `dependencies`; CIDs come from `@atproto/lex-data` via
  `@atproto/lex`
- `@atproto/lex-cli` — `devDependencies`

Add the `@atproto/lex-*` sub-packages only when a file imports them directly.
`pds` lists `lex-cbor`, `lex-data`, and `lex-json` in `dependencies` and
`lex-document` in `devDependencies` for exactly that reason; `bsky` needs none
of them and imports everything through the umbrella.

Keep `@atproto/api` only where it is genuinely still used. It stays a
devDependency of `pds` (tests) and a runtime dependency of `bsky` (two source
files import `getAgeAssuranceRegionConfig` and age-assurance helpers from it).

Every package touched needs a `.changeset/` entry — `minor` for a package
whose public API changes, `patch` otherwise.

## Gitignore

Generated output is a build artifact:

```
# @atproto/lex
src/lexicons
```

Replaces the `# @atproto/lex-cli` / `src/lexicon` stanza. Note singular →
plural: `src/lexicon` was the legacy path, `src/lexicons` is the new one. Both
lines are unanchored patterns, not `/src/lexicons/`.

## Deleting the legacy tree

```sh
rm -rf ./src/lexicon
```

Safe because it was gitignored and regenerated. Verify nothing still imports
it before deleting — in ozone that is ~76 source files plus ~47 test files, so
expect the package not to compile until step 3 is done.

Do **not** touch the repo-root `lexicons/` directory. It is canonical
committed source shared by every package and the interop fixtures.

## What does not apply in this monorepo

`lex install`, `manifest.json` / `lexicons.json`, and a `postinstall` hook are
real `@atproto/lex` features for consuming schemas published over the network.
No package here uses them, because the schemas are committed at the repo root.
Do not introduce a manifest during a migration.
