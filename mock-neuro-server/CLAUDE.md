# mock-neuro-server — Test double for Neuro RemoteLogin

A standalone Express server that mocks the Neuro identity provider for PDS tests and local development. Used wherever a real Neuro endpoint would be — login callbacks, JID lookups, JWT issuance for tests.

## Stack

- Node.js (single `server.js`, no TypeScript)
- Lightweight Express + `jose`

## When to use

- **Local dev** — start it alongside `make run-dev-env` if you need to exercise the Neuro flow without a real Neuro tenant
- **PDS tests** — `packages/pds/tests/admin-neuro-endpoints.test.ts` and friends spin this up

## Don't ship it

`mock-neuro-server/` is not bundled with any production image. Never point a deployed PDS at it.

## See also

- `.claude/docs/dev/mock-neuro-server.md` — endpoint inventory + behaviour
- `.claude/docs/pds/neuro-auth.md` — real Neuro integration
