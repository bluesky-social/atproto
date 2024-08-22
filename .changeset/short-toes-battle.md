---
"@atproto/oauth-provider": minor
"@atproto/oauth-client": minor
"@atproto/oauth-client-browser": minor
"@atproto/oauth-client-node": minor
---

Remove "openid" compatibility. The reason is that although we were technically "openid" compatible, ATProto identifiers are distributed identifiers. When a client relies on OpenID to authenticate users, it will use the auth provider in combination with the identifier to uniquely identify the user. Since ATProto identifiers are meant to be able to move from one provider to the other, OpenID compatibility could break authentication after a user was migrated to a different provider.

The way OpenID compliant clients would adapt to this particularity would typically be to remove the provider + identifier combination and use the identifier alone. While this is indeed the right way to handle ATProto identifiers, it requires more work to avoid impersonation. In particular, when obtaining a user identifier, the client **must** verify that the issuer of the identity token is indeed the server responsible for that user. This mechanism being not enforced by the OpenID standard, OpenID compatibility could lead to security issues. For this reason, we decided to remove OpenID compatibility from the OAuth provider.

Note that a trusted central authority could still offer OpenID compatibility by relying on ATProto's regular OAuth flow under the hood. This capability is out of the scope of this library.
