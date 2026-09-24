---
"@atproto/oauth-provider": patch
---

Make CSP narrower by replacing the `data: https:` directive needed for customization images with either an exact uri or `'sha256-<hash>'` directive
