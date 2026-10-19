---
"@atproto/oauth-provider": patch
---

Avoid un-necessary "await" (event loop ticks) when invoking non-present hooks.
