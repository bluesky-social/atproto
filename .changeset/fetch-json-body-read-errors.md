---
'@atproto-labs/fetch': patch
---

`fetchJsonProcessor` only reports a body that fails to parse as "Unable to parse response as JSON". Errors while reading the body now propagate as they are, and a streamed body exceeding `fetchMaxSizeProcessor`'s limit fails with a `FetchResponseError` (502, "Response too large"), as an oversized `Content-Length` already did.
