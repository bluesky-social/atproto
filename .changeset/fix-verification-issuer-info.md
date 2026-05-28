---
'@atproto/bsky': patch
---

Fix `verificationView`'s `displayName` and `handle` to reflect the verification issuer rather than the subject, and rename them to `issuerDisplayName` and `issuerHandle`. These fields were introduced in #5015 to expose the issuer's identity, but were inadvertently being populated with the subject's snapshot stored on the verification record.
