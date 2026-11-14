---
"@atproto/oauth-provider": patch
"@atproto/pds": patch
"@atproto/oauth-client-browser-example": patch
---

The FedCM assertion endpoint returns a signed `atproto-id+jwt`, so an app can authenticate a user without OAuth. It requires a `params` field with a nonce, the account's FedCM device, and a recent password sign-in. Enabling FedCM requires `AccountStore.getAccountSigner`; the PDS signs with the account's repo key. The browser example verifies the token and can sign in with FedCM alone.
