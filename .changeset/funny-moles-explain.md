---
"@atproto/pds": patch
---

Allow access to `com.atproto.server.getSession` when authenticated using oauth credentials. Email info (`email`, `emailConfirmed`) will only be exposed if the credentials were issued with the `transition:email` scope.
