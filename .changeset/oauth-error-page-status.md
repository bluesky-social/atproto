---
'@atproto/oauth-provider': patch
'@atproto/oauth-provider-ui': patch
---

Provide the error page with the HTTP status it is served with (new `__errorStatus` hydration data), allowing it to recognize the errors that depend on it (e.g. rate limits)
