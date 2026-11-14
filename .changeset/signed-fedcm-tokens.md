---
"@atproto/oauth-provider": minor
"@atproto/pds": patch
"@atproto/oauth-client-browser-example": patch
---

**BREAKING:** The FedCM assertion endpoint now returns a signed `atproto-id+jwt` instead of a bare DID. It requires a `params` field with a nonce, the account's FedCM device, and a recent password sign-in. Enabling FedCM now requires `AccountStore.getAccountSigner`, and the provider throws at construction without it. The PDS signs with the account's repo key, and the browser example verifies the token and can sign in with FedCM alone.
