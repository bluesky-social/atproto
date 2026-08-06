---
name: lexification-server
description: >
  Migrate a service package off the legacy server stack — `lex gen-server`
  codegen, a committed `src/lexicon/` tree, `server.<ns>.<method>()` route
  chains, `@atproto/api` inside service code — onto `@atproto/lex` and
  `@atproto/xrpc-server`. Use when asked to lexify, modernize, or migrate a
  server package; when a route file imports `Server` or `createServer` from
  `../lexicon/index.js`; when replacing `ids.*` constants, generated `isX()`
  guards, `server.xrpc.router`, or `QueryParams`/`OutputSchema` type imports;
  and when a package still runs `lex gen-server` in its `codegen:lex` script.
  For the calls a service makes *out* to other services, use
  lexification-client. For writing new routes on an already-migrated package,
  use xrpc-server.
disable-model-invocation: false
---

# Lexification: migrating a service package

Moves a package from `@atproto/lex-cli`'s `lex gen-server` output to
`@atproto/lex` schemas plus `@atproto/xrpc-server` routing.

`packages/pds` and `packages/bsky` are already migrated — **read them before
inventing a pattern.** `packages/ozone` is the only service left, so it is
both the likely subject of the task and the reference "before" state.

## Which skill applies

| Situation                                                    | Skill                                                  |
| ------------------------------------------------------------ | ------------------------------------------------------ |
| Package has `src/lexicon/` (singular) and route chains       | **this skill**                                         |
| Adding a route to a package already on `server.add()`        | [xrpc-server](../xrpc-server/SKILL.md)                 |
| The same package's outbound `AtpAgent` / `agent.api.…` calls | [lexification-client](../lexification-client/SKILL.md) |

A service migration almost always needs this skill _and_
lexification-client: one package both serves routes and calls other services.
Do the server half first — it forces `src/lexicons/` into existence, which the
client half then imports from.

## Guiding principles

- **Type-level changes over runtime changes.** Working runtime logic stays;
  what changes is where types and constants come from. A migration diff that
  alters behavior is a bug in the migration.
- **Migrate one namespace of route files at a time**, building in between.
  A route file is self-contained, so a broken one doesn't block the rest.
- **Leave test call sites on `AtpAgent`.** Tests double as the regression
  check that the migration didn't change behavior — swapping the client they
  use destroys that signal. Tests that import _types or constants_ from the
  deleted `src/lexicon/` do have to move (details below).

## Order of work

1. **Project config** — swap codegen, deps, gitignore, delete `src/lexicon/`.
   → [references/project-config.md](references/project-config.md)
2. **Server bootstrap** — `createServer`, `Server` type, Express mount.
3. **Route files** — `server.<ns>.<method>(…)` → `server.add(schema, …)`.
   → [references/routes.md](references/routes.md)
4. **Constants and guards** — `ids.*`, `isX()`, token exports, `$build`.
   → [references/types-and-guards.md](references/types-and-guards.md)
5. **Outbound calls** — [lexification-client](../lexification-client/SKILL.md).
6. **Branded types** at function/interface/DB boundaries.
   → [references/types-and-guards.md](references/types-and-guards.md)

Steps 1–2 are a single non-splittable commit (the package won't compile
in between). Steps 3–6 are incremental.

## Server bootstrap

The only structural change in the whole migration. `createServer` and `Server`
stop coming from generated code:

```diff
- import { createServer } from './lexicon/index.js'
+ import { createServer } from '@atproto/xrpc-server'

- let server = createServer({
+ const server = createServer([], {
    validateResponse: config.debugMode,
    payload: { /* … */ },
  })

- app.use(server.xrpc.router)
+ app.use(server.router)
```

The new first argument is an array of legacy `LexiconDoc`s for routes not
backed by a generated schema; schema-based setups pass `[]`. Option names
(`validateResponse`, `payload`, `catchall`, `rateLimits`, `errorParser`) are
unchanged — see [packages/pds/src/index.ts](../../../packages/pds/src/index.ts).

In route files, `Server` comes from the same package:

```diff
- import { Server } from '../../../../lexicon/index.js'
+ import type { Server } from '@atproto/xrpc-server'
```

## Import mapping

| Before                                                 | After                                                                |
| ------------------------------------------------------ | -------------------------------------------------------------------- |
| `../lexicon` (`Server`, `createServer`)                | `@atproto/xrpc-server`                                               |
| `../lexicon/lexicons` (`ids`)                          | `../lexicons/index.js` → `.$type` / `.$lxm`                          |
| `../lexicon/types/…` (record & def types)              | `../lexicons/index.js` → `.Main`, `.ViewRecord`, …                   |
| `../lexicon/types/…` (`QueryParams`, `OutputSchema`)   | `../lexicons/index.js` → `.$Params`, `.$OutputBody`                  |
| `../lexicon/types/…` (`isX`, `validateX`)              | `../lexicons/index.js` → `.$isTypeOf`, `.$matches`, `.$safeValidate` |
| `../lexicon/util` (`$Typed`, `Un$Typed`)               | `@atproto/lex`                                                       |
| `@atproto/api` (`AtpAgent`)                            | `@atproto/lex` (`Client`)                                            |
| `@atproto/lexicon` (`jsonStringToLex`, `stringifyLex`) | `@atproto/lex` (`lexParse`, `lexStringify`)                          |
| `@atproto/lexicon` (`BlobRef`)                         | `@atproto/lex` (`BlobRef`)                                           |
| `@atproto/xrpc` (`HeadersMap`)                         | `@atproto/xrpc-server` (`Headers`, usually aliased)                  |
| `@atproto/xrpc` (`XRPCError`, thrown by a _caller_)    | `@atproto/lex` (`XrpcError`)                                         |
| `multiformats/cid` (`CID`)                             | `@atproto/lex` (`Cid`, `parseCid`)                                   |

`@atproto/xrpc-server` keeps its own `XRPCError` for errors handlers **throw**.
The casing distinguishes them: `XRPCError` server-side (concrete, thrown),
`XrpcError` client-side (abstract, caught). Both can appear in one file.

`@atproto/lex` re-exports `lex-client`, `lex-schema`, `lex-data`, and
`lex-json`, so `Cid`, `BlobRef`, `lexParse`, and `$Typed` all resolve from it.
`@atproto/lex-cbor` is **not** re-exported. Importing from either the umbrella
or the sub-package is fine; match whatever the file already does.

## Pitfalls

- **`$type` vs `$lxm` vs `$nsid`.** `$type` is the record/object type string
  (`app.bsky.feed.post.$type` → `'app.bsky.feed.post'`), used for collections
  and union tags. `$lxm` is the method id, used in auth and proxy checks.
  `$nsid` is the raw NSID, needed for `defs` documents that have no `main`.
  They can hold identical strings, so a wrong one type-checks and only fails
  at runtime.
- **`$matches` vs `$isTypeOf`.** `$isTypeOf` only reads the `$type` tag;
  `$matches` validates the whole value. Substituting `$isTypeOf` where the
  data is unvalidated silently accepts malformed records. See
  [references/types-and-guards.md](references/types-and-guards.md).
- **`encoding` widening** affects only the bare-handler form of `server.add`,
  not the object form. Don't sprinkle `as const` everywhere — see
  [references/routes.md](references/routes.md).
- **Branded strings arriving from outside TypeScript's view** — protobuf,
  Kysely rows, `JSON.parse` — are plain `string`. Cast once at the boundary
  (`as DidString`), never deep in the call graph.
- **Generated `src/lexicons/` is gitignored.** It won't exist until
  `pnpm run codegen` (or a build) runs. "Cannot find module '../lexicons/index.js'"
  means codegen hasn't run, not that the import is wrong.

## Tests

Test _call sites_ keep using `AtpAgent`, deliberately (see principles above).
`dev-env` exposes both `getAgent(): AtpAgent` and `getClient(): Client`, so a
new-style client is available when a test genuinely needs one.

What must move is anything a test imported from the now-deleted
`src/lexicon/`. Two valid destinations, both already used in migrated
packages:

```diff
- import { ids } from '../../src/lexicon/lexicons'
- import { isRepoRef } from '../../src/lexicon/types/com/atproto/admin/defs'
+ import { com } from '../../src/lexicons/index.js'      // generated schemas
+ import { $Typed, ComAtprotoAdminDefs, ids } from '@atproto/api'  // legacy equivalents
```

Prefer `../../src/lexicons/index.js` for new code; `@atproto/api` is the
lower-churn option when the surrounding test is otherwise untouched. Do not
add `@atproto/api` back to a package's dependencies just for this — it is a
devDependency in `pds` and only a runtime dependency in `bsky` because of
`getAgeAssuranceRegionConfig`, unrelated to tests.

Before writing or restructuring tests, use the
[testing skill](../testing/SKILL.md) — `pds` and `ozone` are jest, `bsky` is
vitest.

## Related skills

[xrpc-server](../xrpc-server/SKILL.md) documents the target route API in full
and is the better reference once a package is migrated.
[lex-setup](../lex-setup/SKILL.md) owns codegen wiring,
[lex-schema](../lex-schema/SKILL.md) the `$`-accessors, and
[lex-data](../lex-data/SKILL.md) branded strings, CIDs, and blobs.
