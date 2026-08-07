---
'@atproto/pds': patch
---

Don't require the server to hold the PLC rotation key in order to activate an account, or to report its DID document as valid via `checkAccountStatus` - a self-custodied account (where the user keeps their own rotation key) is a legitimate setup. Activation still requires the DID document's PDS endpoint and signing key to match this server, and still rejects a tombstoned DID.
