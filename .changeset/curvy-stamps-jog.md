---
"@atproto/oauth-provider": patch
"@atproto/oauth-provider-ui": patch
---

Improve handling of "remember" setting during sign-in and sign-up. Keeps current "remember me" status when user did not explicitly enable/disable it (avoiding sign users out when they are presented with a UI that does not show the "remember me" option)
