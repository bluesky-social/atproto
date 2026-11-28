---
'@atproto-labs/fetch-node': minor
---

Resolve hostnames with a `dns.Resolver` by default, instead of `dns.lookup`. `dns.lookup` runs on libuv's threadpool and cannot be cancelled, so a few hosts whose nameservers don't answer could stall every other DNS lookup, file read or hash in the process. The new `createResolverLookup()` lookup does not use the threadpool and gives up after a 2-second timeout per query (2 tries). It does not read `/etc/hosts` or apply search domains.

`createSafeFetch()` (formerly `safeFetchWrap()`) and `createUnicastFetch()` (formerly `unicastFetchWrap()`) now use this lookup unless you pass a `lookup` option. To keep using the system resolver, pass `lookup: createLimitedLookup()`, which runs one `dns.lookup` call at a time so that it cannot take every threadpool thread, or `lookup: dns.lookup`. When private IPs are allowed (`allowPrivateIps: true`, the default when `ssrfProtection` is `false`), `createSafeFetch()` still defaults to `dns.lookup`, so local services named in `/etc/hosts` stay reachable.

Rename `safeFetchWrap` to `createSafeFetch`, `unicastFetchWrap` to `createUnicastFetch`, `safeDispatchFetchWrap` to `createDispatcherFetch` and `unicastLookupWrap` to `createUnicastLookup`, and their `*WrapOptions` types to `SafeFetchOptions`, `UnicastFetchOptions` and `DispatcherFetchOptions`. The previous names remain available as deprecated aliases. `createUnicastLookup()` checks the results of `createResolverLookup()` when no lookup is given.

`createUnicastLookup()` (formerly `unicastLookupWrap()`) now reports each address with the family derived from the address itself, which `net.connect` uses to dial it, rather than the family the wrapped lookup reported.
