---
"@atproto-labs/fetch": patch
---

`peekJson` no longer constructs a `Response` to enforce its size limit, so it works when the global `Response` can't wrap a stream (e.g. React Native's whatwg-fetch polyfill alongside Expo's `fetch`). A body over the limit now rejects with a `FetchResponseError`.
