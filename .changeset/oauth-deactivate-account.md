---
'@atproto/pds': patch
---

Allow OAuth sessions holding the `account:status?action=manage` permission to call `com.atproto.server.deactivateAccount`. Deactivating through OAuth also revokes every OAuth session, authorized client and app password, matching the account manager along with the fact that OAuth logins are not allowed via deactivated accounts. `com.atproto.server.activateAccount` still rejects OAuth credentials, now with a message pointing users to their account management page.
