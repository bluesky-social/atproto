---
"@atproto/oauth-client-browser": minor
"@atproto/oauth-client-node": minor
"@atproto/oauth-client": minor
---

The `OAuthClient` (and runtime specific sub-classes) no longer return @atproto/api `Agent` instances. Instead, the return `OAuthSession` instances that can be used to instantiate the `Agent` class.
