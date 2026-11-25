---
'@atproto/oauth-client-expo': patch
---

Fix `ExpoOAuthClient` failing to resolve in Metro by importing `./expo-oauth-client` without an extension so platform-specific builds (`.native.js`/`.web.js`) are used.
