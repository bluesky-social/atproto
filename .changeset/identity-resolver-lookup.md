---
'@atproto/identity': patch
---

The default fetch, used when no `fetch` is passed to a resolver, now resolves hostnames with a `dns.Resolver` instead of `dns.lookup`, through `@atproto-labs/fetch-node`'s new `createSafeFetch` default. It does not read `/etc/hosts` or apply search domains.
