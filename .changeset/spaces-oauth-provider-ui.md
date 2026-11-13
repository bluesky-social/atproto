---
'@atproto/oauth-provider-ui': patch
---

Describe `space:` scopes on the consent screen, including those granted through `include:` permission sets: each space type (by its declaration's `title`, or its NSID), its authority (by verified handle, or DID), and the read, write and manage access requested. Warn when an application requests access to every space on the network. The `AuthorizeData` hydration data carries `spaces` and `spaceHandles`.
