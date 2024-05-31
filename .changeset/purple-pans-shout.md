---
"@atproto/lex-cli": minor
"@atproto/xrpc": minor
"@atproto/api": minor
"@atproto/xrpc-server": patch
"@atproto/dev-env": patch
"@atproto/lexicon": patch
"@atproto/ozone": patch
"@atproto/bsky": patch
"@atproto/pds": patch
---

**New Features**:

1) Improved Separation of Concerns: We've restructured the XRPC HTTP call dispatcher into a distinct class. This means cleaner code organization and better clarity on responsibilities.
2) Enhanced Evolutivity: With this refactor, the XRPC client is now more adaptable to various use cases. You can easily extend and customize the dispatcher perform session management, retries, and more.

**Compatibility**:

Most of the changes introduced in this version are backward-compatible. However, there are a couple of breaking changes you should be aware of:

- Customizing `fetchHandler`: The ability to customize the fetchHandler on the XRPC Client and AtpAgent classes has been modified. Please review your code if you rely on custom fetch handlers.
- Managing Sessions: Previously, you had the ability to manage sessions directly through AtpAgent instances. Now, session management must be handled through a dedicated `SessionDispatcher` class. If you were using session management directly, you'll need to update your code accordingly.
