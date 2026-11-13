---
'@atproto-labs/handle-resolver-node': patch
---

Fix the response size limit of the `safeFetch` that `AtprotoHandleResolverNode` builds by default: 10 KiB, not 10,480 bytes.
