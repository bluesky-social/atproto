---
"@atproto/oauth-client-browser-example": patch
"@atproto/dev-env": patch
---

The FedCM demo launcher (`start:fedcm`) now runs only a PDS and PLC, so it no longer needs Docker. The browser example accepts `bsky_api_did=none` to run without an AppView.
