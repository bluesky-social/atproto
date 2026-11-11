---
"@atproto/oauth-provider": minor
"@atproto/oauth-provider-api": patch
"@atproto/oauth-provider-ui": patch
---

Support Chrome's experimental FedCM IdP Registration: register the PDS as an identity provider (type `https://atproto.com`) and push remembered accounts to the browser on every session change.

`@atproto/oauth-provider`'s FedCM assertion endpoint now answers for any active local account without requiring a device session. This applies to every FedCM flow, including the one without IdP Registration.
