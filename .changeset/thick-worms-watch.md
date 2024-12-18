---
"@atproto-labs/handle-resolver": patch
---

This change makes the DoH handle resolver accept a wider range of content types for DoH API calls.

While there is no agreed upon MIME type for DoH's JSON Schema, this change supports a reasonable
set that include those used by major DoH providers such as Google and Cloudflare.
