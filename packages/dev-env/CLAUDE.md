# @atproto/dev-env — Local development environment

Spins up a full atproto stack (PDS + AppView + ozone + PLC + bsync + bsync) in-process for tests and `make run-dev-env`. **This is the canonical test harness** — most integration tests in this repo go through `TestNetwork` exported here.

## Entrypoints

```
src/
  bin.ts                Runnable entry (`pnpm run start` from this package)
  network.ts            TestNetwork — full stack including AppView
  network-no-appview.ts TestNetworkNoAppView — PDS-only, faster for PDS-only tests
  pds.ts, bsky.ts, ...  Individual service test fixtures
  seed/                 Pre-baked seed data (users, posts, follows, ...)
  mock/                 Mock identity services (PLC, mail, etc.)
```

## When to use which

- **`TestNetwork`** — anything that exercises AppView reads after a PDS write
- **`TestNetworkNoAppView`** — PDS-internal flows (account creation, invitations, Neuro)
- **Seed builders** — when you need a populated network; check `src/seed/` for existing builders before writing your own

## Don't ship this

`@atproto/dev-env` is a devDependency. It pulls in everything; keep it out of production code paths.

## See also

- `.claude/docs/dev/dev-env.md` — workflow guide
- `.claude/docs/dev/testing.md` — test patterns
