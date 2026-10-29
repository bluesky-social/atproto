---
"@atproto/pds": minor
"@atproto/api": minor
---

Replace `com.atproto.simplespace` with a space `policy` object and three baseline policies. A space's `policy` is an open union discriminated by `$type` that both selects the policy governing the space and carries its configuration.

`createSpace`, `updateSpace`, `deleteSpace`, and `getSpace` move to `com.atproto.space`. `createSpace` takes a `policy` in place of `readPolicy`, `writePolicy`, and `appAccess`. `updateSpace` replaces the `policy` wholesale. Changing its `$type` migrates the space, discarding state held by the previous policy (such as a member list). `getSpace` returns the `uri` and `policy`, and requires OAuth as the space owner (a space credential is no longer accepted). An unimplemented policy is refused with `UnsupportedPolicy`. `UnsupportedAppAccess` is removed.

The baseline policies are `com.atproto.personalspace.policy` (only the authority has access), `com.atproto.memberspace.policy` (`publicRead` and `publicWrite` flags, defaulting to false, under which only members with the corresponding access are authorized), and `com.atproto.managedspace.policy` (each user decision is deferred to a `managingApp`). In place of `appAccess`, `memberspace` carries an optional `allowedApps` list of OAuth client IDs. When it is set, only those apps (by attested `client_id`) may read the space. `personalspace` and `managedspace` do not restrict apps, though a managing app is passed the attested `client_id` on reads and may decide on it. `putMember`, `removeMember`, and `listMembers` move to `com.atproto.memberspace`, and are refused with `PolicyMismatch` on a space under another policy. `checkUserAccess` moves to `com.atproto.managedspace`.

`getSpaceCredential` now checks the user before the app, and answers a user the policy does not authorize with `SpaceNotFound` rather than `UserNotAuthorized`, so a refusal discloses nothing about the space to someone without access to it.

`memberspace` and `managedspace` policies take a `publishPolicy` flag, and `memberspace` also takes `publishMembers`. When set, the authority's PDS publishes the policy as a `com.atproto.space.policy` record (key `self`) and each member as a `com.atproto.memberspace.member` record (keyed by the member's DID) in the authority's own repo in the space, and keeps them in sync with the configuration. Writing these records directly through the space record methods is refused in any repo.

The PDS migrates each existing simplespace config to a baseline policy. A config with a managing app on either side becomes a `managedspace` policy, and its member list and app allow-list are dropped. Any other becomes a `memberspace` policy.
