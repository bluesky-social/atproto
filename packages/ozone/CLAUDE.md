# @atproto/ozone — Moderation backend service

Backend for the Ozone moderation console (the UI lives in the sibling `ozone/` repo at the workspace level). Implements `tools.ozone.*` XRPC endpoints: report intake, account/label actions, team management, moderator audit trail.

> Not to be confused with `../../ozone/` — that's the Next.js admin UI that talks to **this** service.

## Stack

- **Framework:** Express + `@atproto/xrpc-server`
- **DB:** Postgres via `kysely`
- **Background:** custom daemon (`daemon/`) for scheduled actions, label propagation, jetstream consumption
- **Jetstream:** `jetstream/` — consumes the firehose as a moderator
- **Communication:** templated email/Slack notifications to reporters and subjects
- **Image:** invalidation hooks for CDN purge

## Layout (`src/`)

```
api/                       XRPC handlers for tools.ozone.*
auth-verifier.ts           Moderator-token verification
config/                    Env parsing
context.ts                 AppContext DI
daemon/                    Background workers (scheduled actions, label sync)
db/                        Postgres migrations + queries
mod-service/               Core moderation actions (apply/revoke labels, takedowns, ...)
team/                      Moderator team + role management
set/                       Labeler "sets" (groupings of subjects)
verification/              Account verification badges
safelink/                  URL safety lists
tag-service/               Subject tags
setting/                   Server settings
scheduled-action/          Delayed/conditional actions
sequencer/                 Audit-event firehose
jetstream/                 Firehose consumer (for live moderation context)
communication-service/     Templated comms (email/Slack)
```

## Commands

```sh
pnpm --filter @atproto/ozone test
pnpm --filter @atproto/ozone build
```

Service entrypoint: `services/ozone/`.

## See also

- `.claude/docs/ozone/overview.md`
- The Ozone UI lives in `../../ozone/` — see `../../.claude/ozone.md` in the workspace for context.
