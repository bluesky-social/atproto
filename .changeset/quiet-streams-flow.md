---
"@atproto/lex-rpc": patch
"@atproto/lex-client": patch
"@atproto/lex": patch
---

Add `xrpcStream()` / `xrpcStreamSafe()` (and `Client.xrpcStream()`, `Client.xrpcStreamSafe()`, `Client.getBlobStream()`), returning binary response payloads as an unread `ReadableStream` through a disposable `XrpcStreamResponse`. Response bodies are now always released (cancelled) when response processing fails, as configured by the new `onCancellationError` response option (defaults to `"propagate"`).
