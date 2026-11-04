---
"@atproto/pds": minor
---

Authenticate `com.atproto.space.unregisterNotify` with service auth from the subscriber instead of a space credential. The issuer must be the service being withdrawn or its DID, and the audience the space authority. A space credential names no service, so any holder could previously withdraw another service's registration.
