# @atproto/ws-client — WebSocket client (W Social addition)

Thin WebSocket client used for long-lived atproto streams (firehose subscriptions and similar). Added by W Social on top of the upstream packages.

## Stack

- `ws` (^8.12) for the underlying socket
- Depends on `@atproto/common` for utility helpers
- TypeScript, builds to `dist/`

## Layout

```
src/                       Client implementation
tests/                     Jest tests
```

## Commands

```sh
pnpm --filter @atproto/ws-client test
pnpm --filter @atproto/ws-client build
```

## When to use it

Use this package — not raw `ws` — for any atproto WebSocket consumer in this repo. It centralises reconnection, backoff, and CBOR framing.
