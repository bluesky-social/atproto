# @atproto/xrpc-server — XRPC server framework

The server-side counterpart to `@atproto/xrpc`. Used by PDS, AppView, ozone, and bsync to expose XRPC endpoints. Handles:
- Route registration from lexicon definitions
- Input/output validation against the lexicon
- Error responses (`InvalidRequestError`, `AuthRequiredError`, ...)
- Subscription (WebSocket) endpoints — the firehose lives on this

## How a handler is registered

1. Lexicon JSON defines the NSID and shapes
2. `make codegen` emits a `Server` interface into the consuming package's `src/lexicon/`
3. The service wires a handler via `server.eu.wsocial.<...>.method({ auth, params, input }, ctx)`

See `packages/pds/src/api/eu/wsocial/` for canonical examples.

## See also

- `XRPC_ARCHITECTURE.md` in repo root — detailed walk-through
- `.claude/docs/atproto/xrpc-server.md`
