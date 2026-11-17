---
"@atproto/lex-rpc": patch
"@atproto/lex-password-session": patch
---

Fix `ReferenceError`s in environments that do not define a `ReadableStream` global (e.g. React Native), when sending `Blob` request bodies, when processing failed requests, and when refreshing expired password sessions.
