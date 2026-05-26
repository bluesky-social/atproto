# @atproto/xrpc — XRPC client

The low-level HTTP+JSON client for XRPC. Wrapped by `@atproto/api` for typed access. Handles:
- Request encoding (params, body, headers)
- Response parsing
- Error normalisation (`XRPCError`)
- Auth header injection

## When to touch

- Adding a new transport feature (e.g. new auth scheme)
- Fixing a serialisation bug

For everyday work — adding an endpoint, calling a service — use `@atproto/api`, which sits on top of this.
