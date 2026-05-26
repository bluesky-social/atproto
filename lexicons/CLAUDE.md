# lexicons/ — JSON schemas for XRPC endpoints

The source of truth for every XRPC endpoint, record type, and subscription in this repo. Each file defines one NSID. Tooling (`@atproto/lex-cli`) reads these and emits TypeScript clients + server stubs.

## Directory map

| Tree | Owner | Touchable? |
|---|---|---|
| `com/` | atproto core (Bluesky) | **No** — upstream-owned, federation breaks if we diverge |
| `app/` | Bluesky app schemas | **No** — upstream-owned |
| `chat/` | Bluesky chat | **No** — upstream-owned |
| `tools/` | Ozone moderation | **No** — upstream-owned |
| `io/trustanchor/` | Trust Anchor / QuickLogin | **Coordinated** — W Social + Trust Anchor co-own; coordinate before changing |
| `eu/wsocial/` | **W Social — yes, edit freely** | All W Social-specific endpoints go here |

## eu/wsocial layout

```
eu/wsocial/
  admin/                  Admin endpoints (createPassInvitation, ...)
  quicklogin/             Account-side QuickLogin endpoints (linkWid, ...)
  server/                 Server-config endpoints (allocateWidForAccount, checkHandleAvailability, ...)
```

## Authoring rules

1. **Reverse-DNS NSID** — `eu.wsocial.<area>.<verb>`. The file path mirrors the NSID with `/` between segments.
2. **One NSID per file**, named `<verb>.json` (e.g. `createPassInvitation.json`).
3. **`type`** at `defs.main.type` is one of `query`, `procedure`, `subscription`, `record`.
4. **Lint with eslint** — `make fmt-lexicons` enforces JSON formatting.
5. **Codegen after every change** — `make codegen` from repo root. Generated TS is checked in (`packages/*/src/lexicon/`).
6. **No breaking changes without a deprecation window** — the W Social Expo client pins this repo's `@atproto/api` and lags behind PDS deploys.

## See also

- `.claude/docs/atproto/lexicons-and-codegen.md` — full workflow
- `.claude/commands/new-lexicon.md` — scaffolding slash command
- `XRPC_ARCHITECTURE.md` in repo root — how a request flows from JSON → handler
