---
"@atproto/pds": patch
---

Validate `verificationMethods` and `services` in `com.atproto.identity.signPlcOperation` before the email token is consumed, so malformed input is rejected instead of being signed into a PLC operation.
