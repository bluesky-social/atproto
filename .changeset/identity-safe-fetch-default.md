---
'@atproto/identity': patch
---

Identity resolution now goes through a safe fetch by default. The handle
`/.well-known/atproto-did` endpoint, `did:plc` and `did:web` all resolve through
it. Each attempt is also bounded by `timeout` (default 3s), which previously had
no effect on the handle endpoint.

This changes behavior for anyone resolving against localhost or a private
network — a test suite, a local dev stack, an internal PLC mirror. Those callers
pass their own `fetch`, which is used as-is and never re-wrapped:

```ts
new IdResolver({ plcUrl, fetch: globalThis.fetch })
```

Non-ok DID responses now have their bodies cancelled explicitly, which a timeout
helper had been doing implicitly.
