---
"@atproto/pds": minor
"@atproto/api": minor
---

Register for space notifications when requesting a space credential. `com.atproto.space.registerNotify` and `unregisterNotify` are removed. Instead, `getSpaceCredential` takes an optional `notify` object: an `endpoint` to call notification methods against, and a `token` to include in the body of each call. The endpoint and token together identify a registration, and each request carrying the same pair renews it. Before creating a registration, the space host calls `com.atproto.space.confirmRegistration` on the endpoint, which must echo back a random challenge, or the request fails with `RegistrationNotConfirmed`. A refused credential request withdraws the registration it carries.

The space host sends syncers `com.atproto.space.notifySpaceUpdate`, whose `update` is a `repoWrite`, `repoRemoved`, `spaceDeleted`, or `registrationExpired`. It replaces `notifySpaceDeleted`, and `notifyRepoUpdate` is now only sent by repo hosts to the space host.

A registration stays active while the credential is valid. Once it expires, the next update to the space is replaced by a `registrationExpired` notice, and nothing more is sent but a deletion notice until the registration is renewed. A syncer unregisters by rejecting its expiry notice. Expiry and deletion notices are retried with a backoff that grows from one minute to twelve hours, for at least 72 hours. A syncer that still can't be reached is unregistered.

`getSpaceCredential` answers `SpaceDeleted` for a deleted space before checking the request's authorization.

Requests to syncer endpoints, to other space hosts, and to managing apps are made with SSRF protection.
