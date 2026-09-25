---
"@atproto/oauth-provider": patch
---

Narrow the CSP `img-src` directive for customization images: the `data:` scheme source is now emitted only when a customization image is actually configured as a `data:` uri, and http(s) customization images contribute their own origin.
