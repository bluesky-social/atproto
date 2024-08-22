---
"@atproto/oauth-client": minor
---

Rename `OAuthSession`'s `request` method to `fetchHandler`. The goal of this change is to allow `OAuthSession` to be used in order to instantiate `XrpcClient` by implementing the `FetchHandlerObject` interface.
