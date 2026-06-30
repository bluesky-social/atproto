---
'@atproto-labs/handle-resolver': patch
---

`WellKnownHandleResolver` no longer swallows unexpected errors thrown before a
network exchange. Previously every failure (other than an abort) was turned into
`null`, which hid the real cause when the SSRF/unicast protection added by
`safeFetchWrap` rejected the request — for example when a handle resolves to a
non-unicast address such as `127.0.0.1` in a local development setup. Genuine
network failures (which the WHATWG fetch standard surfaces as a `TypeError`)
still resolve to `null`, but any other error now bubbles up so callers can
understand why handle resolution failed.
