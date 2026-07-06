---
'@atproto-labs/handle-resolver': patch
'@atproto-labs/handle-resolver-node': patch
---

Add an `onError` observability option to the handle resolvers. `WellKnownHandleResolver` previously swallowed every non-abort failure and returned `null`, indistinguishable from "no `.well-known/atproto-did` endpoint exists". Passing `onError` when constructing a resolver (including `AtprotoHandleResolver` and `AtprotoHandleResolverNode`) exposes the underlying cause (SSRF blocks, 5xx upstream errors, redirects, network errors, etc.) without changing the `null` return contract. Because it is set on the instance, it also covers resolution performed internally, for example by an OAuth client the resolver is passed to.
