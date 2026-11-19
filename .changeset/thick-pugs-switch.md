---
'@atproto/lex-rpc': patch
---

Add XRPC subscription support with `xrpcSubscribe(agent, ns, options)`, exported by the new `@atproto/lex-rpc/subscription` entrypoint: an async generator of the subscription's messages, validated against its message schema. Failures are reported as `XrpcSubscriptionError` subclasses, and `isRetryableSubscriptionError()` classifies them for a reconnect policy.

Subscriptions connect through the new optional `Agent.websocketHandler`. `buildAgent()` creates one from the new `AgentConfig.websocket` option, a `fetch`-like function called with the `ws(s)` URL of the `service` and the agent's `headers`. The `@atproto/lex-rpc/subscription` entrypoint also exports `createWebSocketFactory(options)`, creating one over `@atproto/ws-client` with the given connection options, and `defaultWebsocket`, created with the default options, which `xrpcSubscribe()` uses when given a service URL, or an `AgentConfig` without its own `websocket`. Both reconnect per `defaultSubscriptionShouldReconnect()`, which extends `@atproto/ws-client`'s `defaultShouldReconnect()` with `isRetryableSubscriptionError()`.

The `params` option of `xrpc()`, `xrpcSafe()` and `xrpcSubscribe()` also accepts a (possibly async) function returning the params, invoked for every attempt (each retry, each subscription reconnection).
