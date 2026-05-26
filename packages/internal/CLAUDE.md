# packages/internal/* — Internal helper libraries

Small focused packages that are reused across services but don't deserve a top-level name. Not published independently; treat them as internal.

## Subpackages

| Package | Purpose |
|---|---|
| `did-resolver` | Lower-level DID resolution primitives |
| `fetch` | Cross-platform fetch wrapper with retry/timeout |
| `fetch-node` | Node-specific fetch (with TLS knobs) |
| `handle-resolver` | Handle → DID resolution (platform-neutral) |
| `handle-resolver-node` | Node-specific resolver (DNS over UDP, etc.) |
| `identity-resolver` | Unified handle + DID resolver facade |
| `pipe` | Stream/pipeline helper for async iterators |
| `rollup-plugin-bundle-manifest` | Rollup plugin used by the OAuth UI build |
| `simple-store` | Key-value store interface |
| `simple-store-memory` | In-memory implementation |
| `simple-store-redis` | Redis-backed implementation |
| `xrpc-utils` | Server-side XRPC helpers (rate limiting, validation) |

## When to touch

- Adding a generic Node helper that more than one service needs → consider one of these instead of inlining
- Switching identity resolution backend → `identity-resolver` is the right seam
- Caching tweaks → `simple-store-*` (don't roll your own cache)
