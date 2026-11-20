---
"@atproto/oauth-provider-ui": patch
---

Keep the 2FA field on the sign-in form when the identifier was normalized (domain appended on blur or Enter) or filled without an input event. The submitted credentials are now the reference for detecting a credential change, so the first keystroke in the code field no longer clears the second factor
