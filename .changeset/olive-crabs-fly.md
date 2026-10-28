---
"@atproto/space": minor
"@atproto/pds": minor
"@atproto/api": minor
---

Support account migration for space data. `com.atproto.space.importRepo` imports the account's repo in a space from a STAR archive, as served by `getRepo`, giving it a new `rev` with unchanged commit `data`. For a space the account is the authority of, `com.atproto.space.exportSpace` downloads its host-side state as a space host archive, and `com.atproto.space.importSpace` imports it on the new host. The space must be imported before the authority's own repo in it. Both imports replace whatever the new host held, so a migration step can be retried. `listSpaces` now documents that it includes the spaces the caller is the authority of.

A space host archive is a STAR file with the `atproto-space-host` profile. Its metadata is the space. Its body is the `policy`, then any policy state keyed like record paths (the `memberspace` member list, as `com.atproto.memberspace.member/{did}` entries), then one `writer/{did}` entry per repo in the writer set. Each section is in strict key order. The PDS rejects an archive with a policy it doesn't implement (`UnsupportedPolicy`) or policy state the policy doesn't define. Notification registrations, credential revocations, and deleted space tombstones are not carried over.

`@atproto/space` adds `serializeSpaceHost` and `readSpaceHostStar` for space host archives, and `readRepoStar`, which reads a repo's STAR archive and checks its records against the commit's data without a MAC. `verifyRepoStar` now reports an unknown commit version as such.

`uploadBlob` makes a blob permanent if a space record already references it, as after a space repo import, just as it does for a public repo import.
