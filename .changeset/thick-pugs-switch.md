---
'@atproto/lex-rpc': patch
---

Add XRPC subscription support with `xrpcSubscribe()`: an async generator of the subscription's messages, validated against its message schema, over a reconnecting `@atproto/ws-client` connection. Failures are reported as `XrpcSubscriptionError` subclasses. Connections are opened through the agent's `fetchHandler`, as a WebSocket handshake request, so the agent's credentials and retries apply to them. Agents created by `buildAgent()` without a custom `fetch` now use a fetch that can open WebSockets (`createWebSocketFetch()`, re-exported from `@atproto/ws-client`).

The `params` option of `xrpc()`, `xrpcSafe()` and `xrpcSubscribe()` also accepts a (possibly async) function returning the params, invoked for every attempt (each retry, each subscription reconnection).
