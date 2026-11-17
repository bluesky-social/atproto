---
"@atproto/lex-rpc": minor
"@atproto/lex-client": minor
"@atproto/lex": minor
---

**Breaking:** the response payload of methods without a declared output encoding is no longer parsed as JSON. It is returned as binary data (a `Uint8Array`, or a `ReadableStream` with `xrpcStream()`), or `undefined` when there is none, and callers that expect JSON must parse it themselves (e.g. `lexParse(new TextDecoder().decode(body))`). Only `application/json` outputs, and outputs with a schema, are parsed.
