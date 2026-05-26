# @atproto/api — High-level client SDK

The typed client library used by application code (and by the W Social Expo app via its `WsocAgent` extension). Wraps `@atproto/xrpc` with:
- Per-NSID typed methods generated from lexicons
- `BskyAgent` / `AtpAgent` session helpers
- Helpers for common types (record references, rich text, blobs)

## When to touch

- After regenerating from lexicons (`make codegen`) — generated files refresh automatically
- Adding non-codegen helpers (rich text utilities, convenience wrappers)

## Versioning

This package is published to npm and consumed by the W Social Expo client. Backwards-incompatible changes need coordination with `../../w-social-next-js/`.
