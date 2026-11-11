---
"@atproto/pds": minor
"@atproto/api": minor
---

Register for space notifications when requesting a space credential. `com.atproto.space.registerNotify` and `unregisterNotify` are removed. Instead, `getSpaceCredential` takes an optional `notify` object: an `endpoint` to call notification methods against, and a `token` to present as a bearer token. The endpoint and token together identify a registration, and each request carrying the same pair renews it. A registration stays active while the credential is valid. After it expires, the registration is kept until one more notification is delivered or permanently rejected, for at most 24 hours. A syncer unregisters by answering a notification with a permanent HTTP error. A refused credential request also withdraws the registration it carries.

The space host now authenticates the `notifyRepoUpdate` and `notifySpaceStatus` calls it sends to syncers with the registered token, in place of service auth. `notifySpaceStatus` also reaches lapsed registrations, and is retried for up to 24 hours.

Requests to syncer endpoints, to other space hosts, and to managing apps are made with SSRF protection.
