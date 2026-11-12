# Project configuration

Read this for step 1 of the migration: replacing `lex gen-server` codegen with
`lex install` and `lex build`, fixing dependencies, and deleting the legacy
generated tree.

`packages/pds`, `packages/bsky` and `packages/ozone` are the "after".

## Codegen

Before (note the hand-maintained glob list and the staleness check):

```jsonc
"codegen:lex": "lex gen-server --yes ./src/lexicon ../../lexicons/com/atproto/*/* ../../lexicons/app/bsky/*/* ../../lexicons/chat/bsky/*/* ../../lexicons/tools/ozone/*/*",
"prebuild": "[ -f ./src/lexicon/index.ts ] && [ -z \"$(find ../../lexicons -newer ./src/lexicon/index.ts -type f -print -quit)\" ] || pnpm run codegen:lex",
```

After: a committed `lexicons.json` manifest, the `lex:install` / `lex:build`
scripts and the `.gitignore` entries from the lex-setup skill's
[Wiring a package in this monorepo](../../lex-setup/SKILL.md#wiring-a-package-in-this-monorepo)
and
[Removing legacy `@atproto/lex-cli` codegen](../../lex-setup/SKILL.md#removing-legacy-atprotolex-cli-codegen).
The glob list becomes the manifest's roots: run `pnpm lex:install <nsid>…` for
the methods and records the package uses, which adds their dependencies too.

## Dependencies

Add to `dependencies`:

- Each `@atproto/lex-*` package the migrated code imports from (`lex-client`,
  `lex-schema`, `lex-data`, `lex-json`, `lex-cbor`), and only those
- `@atproto/xrpc-server` (already present in every service — verify, don't add
  blindly)

Add `@atproto/lex` to `devDependencies` only, for its `lex` bin and for tests:
production code must not import it (see the
[lex-setup skill](../../lex-setup/SKILL.md)).

Remove:

- `@atproto/lexicon` — `dependencies`
- `@atproto/xrpc` — `dependencies`
- `multiformats` — `dependencies`; CIDs come from `@atproto/lex-data`
- `@atproto/lex-cli` — `devDependencies`

Keep `@atproto/api` only where it is genuinely still used. It stays a
devDependency of `pds` (tests) and a runtime dependency of `bsky` (two source
files import `getAgeAssuranceRegionConfig` and age-assurance helpers from it).

## Deleting the legacy tree

```sh
rm -rf ./src/lexicon
```

Safe because it was gitignored and regenerated. Note singular → plural:
`src/lexicon` was the legacy output, `src/lexicons` is the new one. Check what
still imports it before deleting, and expect the package not to compile until
step 3 is done.

Do **not** touch the repo-root `lexicons/` directory. It is canonical
committed source shared by every package and the interop fixtures.
