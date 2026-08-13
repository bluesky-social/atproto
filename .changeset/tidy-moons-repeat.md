---
'@atproto/oauth-provider': patch
'@atproto/oauth-provider-ui': patch
---

Internal clean-up of the OAuth provider API surface: the UI now imports the
CSRF cookie/header names and the API endpoint prefix from
`@atproto/oauth-provider-api` instead of re-declaring them, and optional GET
parameters are omitted from the query string rather than sent as the literal
string `"undefined"`.
