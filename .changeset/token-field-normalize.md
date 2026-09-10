---
'@atproto/oauth-provider-ui': patch
---

Restore live normalization of the one-time code input (uppercase, strip characters outside the base32 alphabet, insert the hyphen) and refocus the input after requesting a new code.
