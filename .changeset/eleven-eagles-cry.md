---
"@atproto/bsky": patch
---

Prevent usage of DPoP bound access tokens with bsky.social

Using DPoP bound access tokens against the bsky server would already fail, but
it would fail with a rather misleading error: "InvalidToken: Bad token scope",
because the `scope` on a DPoP bound access token is the actual OAuth scopes, not
the expected `com.atproto.access` string.

This change means the entryway explicit checks if the token is a DPoP bound
access token, and if it is, then it fails with an error "Malformed token: DPoP
not supported". A similar check is also done with Bearer tokens in the PDS.
