---
'@atproto/lex-rpc': patch
---

Add XRPC subscription support with `xrpcSubscribe()`: an async generator of the subscription's messages, validated against its message schema, over a reconnecting `@atproto/ws-client` connection. Failures are reported as `XrpcSubscriptionError` subclasses. The service is given as a `URL`, or as a (possibly async) function returning one, invoked before every connection. Connection options of `@atproto/ws-client` are passed through to the WebSocket.

The `params` option of `xrpc()`, `xrpcSafe()` and `xrpcSubscribe()` also accepts a (possibly async) function returning the params, invoked for every attempt (each retry, each subscription reconnection).
