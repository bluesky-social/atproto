---
'@atproto/pds': patch
---

Add `PDS_EMAIL_CONFIRMATION_URL` to override the email confirmation link in confirmation emails. The value is a URL template in which `{token}` is replaced with the confirmation token. Defaults to the existing `https://bsky.app/intent/verify-email?code={token}` link, so self-hosted deployments can point users at their own client.
