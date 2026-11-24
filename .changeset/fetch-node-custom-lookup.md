---
'@atproto-labs/fetch-node': patch
---

Add a `lookup` option to `safeFetchWrap` and `unicastFetchWrap` to resolve hostnames with something other than `dns.lookup`. The unicast check still applies to its results, and an address that is not a valid IP is now rejected. `unicastLookupWrap(lookup)` applies the same check to any lookup function, for use with a custom dispatcher.
