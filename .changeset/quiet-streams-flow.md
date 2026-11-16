---
"@atproto/lex-rpc": patch
"@atproto/lex-client": patch
"@atproto/lex": patch
---

Add a per-call `responseType: "stream"` option returning binary response payloads as an unread `ReadableStream`. `XrpcResponse` now implements `Symbol.asyncDispose`, which cancels unconsumed streams. Response bodies are now always released (cancelled) when response processing fails.
