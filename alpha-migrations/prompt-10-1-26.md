Bring this project's existing AT Protocol Spaces functionality up to date with the October 1, 2026 alpha release. Make the smallest changes needed for compatibility. A dependency update, a few caller changes, or a verified no-op can be the complete result.

First inspect the project's instructions, dependencies/lockfile, and existing Spaces usage. Distinguish behavior this project implements itself from behavior supplied by a library, SDK, or external service. Briefly state which changes apply, with the relevant files/packages, then proceed with that scoped work. This is a compatibility reference, not a feature checklist.

Use these boundaries:

| Existing project behavior                                       | Work to consider                                                                                                                                       |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| App, toy, CLI, or utility using an SDK or backend               | Update affected dependencies and existing callers. Let the SDK/backend continue to own protocol internals.                                             |
| Directly exchanges or sends space credentials                   | Client-side signing, credential refresh, and error handling in sections 1–2. Server validation and revocation storage belong to the receiving service. |
| Calls listRepos, including one-off export/debug tools           | Response fields and pagination in section 3. Calling a listing does not require a subscription, background worker, or persistent checkpoint.           |
| Maintains a synchronized copy or receives notifications         | The applicable syncer behavior in section 3.                                                                                                           |
| Implements a repo host or space authority                       | The corresponding server-side requirements in sections 1–3 and any existing simplespace implementation in section 5.                                   |
| Creates/manages spaces or implements managing-app checks        | The existing API calls, policy/member fields, or checkUserAccess handler in sections 4–5.                                                              |
| Schema/codegen library, validator, inspector, or other dev tool | Only affected schemas, formats, generated output, examples, and fixtures that the tool handles.                                                        |

Apply multiple rows where appropriate. Running an application backend does not by itself make it a repo host or space authority. Using OAuth, reading one's own records, or depending on an SDK that supports Spaces does not by itself require space-credential handling. If no affected functionality is present, report the evidence and stop without adding it.

Preserve the project's language, architecture, and feature set. Do not add endpoints, cryptography, databases, revocation stores, durable sync, subscriptions, or retry workers merely because they appear below. Do not migrate SDK families or broadly refactor unrelated code. Implement applicable changes; skip requirements owned by dependencies or external services once their compatibility is established.

For npm consumers, check alpha snapshots before implementing protocol changes yourself.

The [publishing workflow](https://github.com/bluesky-social/atproto/blob/permissioned-data-alpha/.github/workflows/publish.yaml) runs on pushes to permissioned-data-alpha. It runs `pnpm changeset version --snapshot spaces-alpha`, builds, and publishes recursively with `--tag alpha`. Published snapshot versions have the form `0.0.0-spaces-alpha-<timestamp>`. The consumer dist-tag is `alpha`, not `spaces-alpha` or `latest`. These are publishing details; consuming projects do not need to run that workflow or publish anything.

- Identify existing direct dependencies involved in the project's Spaces functionality, including any already using these snapshots. Check each relevant package's `alpha` version and declared dependencies. Not every @atproto or @atproto-labs package necessarily has an alpha release or needs upgrading.
- Resolve the current tag when doing the migration, then pin the resolved version and update the lockfile using the project's package manager. For example, **only if this project already uses @atproto/space**, inspect it with `npm view @atproto/space@alpha version dependencies --json`, then use `npm install --save-exact @atproto/space@<resolved-version>` or `pnpm add --save-exact @atproto/space@<resolved-version>`. Preserve dependency placement and workspace ownership. Do not convert this monorepo's own `workspace:` references to registry dependencies.
- Prefer compatible snapshots from the intended publication for related direct dependencies. Let the package manager resolve their declared transitive dependencies; inspect relevant conflicts or duplicate versions instead of forcing every package to the same version or adding transitive packages as direct dependencies.
- Verify that the resolved publication contains the changes needed by this project. An `alpha` tag alone is not proof: at review time, the checked tags still pointed to `0.0.0-spaces-alpha-20260915165437`, which predates this release. Do not hard-code that old version as the upgrade target. If the new publication is unavailable, report that specific blocker and complete independent edits; do not invent a version, claim the old snapshot is current, or start reimplementing the SDK.
- Use available library helpers for behavior the library owns. Regenerate this project's bindings only if it maintains generated schemas; updating an SDK does not imply copying upstream schemas or running upstream codegen in every app. Fix affected call sites and verify the app's existing flow.

Non-npm projects can skip that step and update only their own affected implementation, schemas, or equivalent dependencies.

Sources: consult the diffs and final files for the applicable sections. Small dependency consumers do not need to audit every upstream server implementation. PR titles or opening descriptions alone may be stale.

- https://github.com/bluesky-social/atproto/pull/5569 — HTTP Message Signatures
- https://github.com/bluesky-social/atproto/pull/5567 — credential lifetime/revocation
- https://github.com/bluesky-social/atproto/pull/5574 — reliable sync
- https://github.com/bluesky-social/atproto/pull/5561 — request-field renames
- https://github.com/bluesky-social/proposals/pull/113
- https://github.com/bluesky-social/proposals/pull/116
- https://github.com/bluesky-social/proposals/pull/109 — revocation; also inspect the final simplespace section

The implementation PRs target the permissioned-data branch. This prompt includes the linked release-intended changes even where a PR is still open. The remaining open PRs were reviewed at atproto#5574: 681067f7407889a710fd8aa162eb29b34108988c and proposals#109: 579e2d96b63f394e58b327d0240adeb6b7aebf15. The other linked PRs were merged at review time. Use these snapshots if the PRs have subsequently changed. For exact wire shapes, use the implementation Lexicons and handlers; the proposals explain the semantics. Reconcile the changes together: older examples in individual PRs can still show superseded authentication, expiry, or revision names.

1. Replace Spaces DPoP binding with HTTP Message Signatures.

Apply this section only to code that implements credential exchange/use or validation. Consumers of a helper should update the helper and its call sites; they do not need their own signing or verification implementation.

Keep ordinary AT Protocol OAuth DPoP working. This change applies to exchanging delegation tokens for space credentials and using those space credentials.

Credential clients generate a fresh ephemeral P-256 keypair for each new space credential. Represent its public key as a P-256 did:key. Keep the private key for the credential's lifetime.

For com.atproto.space.getSpaceCredential, send:

    Authorization: Bearer <delegation-token>
    Signature-Input: atproto-space=("authorization");keyid="<P-256 did:key>"
    Signature: atproto-space=:<standard-base64 signature bytes>:

Cover exactly "authorization". After validating the delegation token and signature, the authority binds the issued credential using cnf.kid = signature keyid, replacing cnf.jkt. Preserve delegation-token single-use/replay checks and optional client attestation. The space credential remains an authority-signed JWT with typ=atproto-space-credential+jwt, iss=space authority, sub=space URI, and no JWT aud claim.

For requests using a space credential, send:

    Authorization: Atproto-Space <space-credential>
    Atproto-Space-Audience: <audience DID>
    Signature-Input: atproto-space=("authorization" "atproto-space-audience")
    Signature: atproto-space=:<standard-base64 signature bytes>:

Cover exactly those two components, in that order. For repo operations, the audience is the repo owner's DID, including when multiple accounts share a PDS. For space-host operations, it is the space authority's bare DID. Derive and validate this audience from the requested operation; do not substitute the hostname, PDS service DID, or #atproto_space_host service identifier.

Use RFC 9421 signature-base construction, including the final "@signature-params" line and canonical structured-field serialization. For the minimal credential example, the signed UTF-8 bytes are the following lines joined by LF, with no trailing LF:

    "authorization": Atproto-Space <space-credential>
    "atproto-space-audience": <audience DID>
    "@signature-params": ("authorization" "atproto-space-audience")

The algorithm is ecdsa-p256-sha256. Encode the signature as exactly 64 bytes, r || s, each a zero-padded 32-byte big-endian integer; reject DER and accept both low-S and high-S. This does not change commit-signature validation. alg is optional; if supplied, require ecdsa-p256-sha256. keyid is required on delegation exchange; on credential use it is optional, and must equal cnf.kid if supplied. Verify credential-use signatures against cnf.kid. Include any supplied signature parameters in the signed signature base.

Receiving services validate the JWT's issuer, signature, type, subject space, lifetime and key binding, as well as the HTTP signature and expected audience. Reject duplicate Authorization or Atproto-Space-Audience fields. Parse the atproto-space signature label correctly even alongside other signature labels.

A signature can be reused for the same credential and audience while the credential remains valid. Do not retain Spaces DPoP requirements for method/URL binding, ath, per-request jti, or nonce/freshness checks. If caching signatures, key them by credential and audience, not just endpoint hostname; adding a cache is optional. Reacquire credentials cached in the old format. Relevant errors include BadSpaceSignature and BadSpaceAudience.

2. Shorten credential lifetime and support targeted revocation.

Credential issuers default space credentials to 600 seconds. Issuers/verifiers enforce a maximum lifetime of 3600 seconds, finite numeric iat/exp, exp > iat, and a nonempty string jti. The reference implementation allows 5 seconds of clock skew and rejects iat beyond that future allowance. Credential clients refresh based on actual expiry, obtaining a fresh key and credential; remove two-hour assumptions. Apps whose dependency manages credentials can leave that behavior with the dependency.

Repo hosts implement com.atproto.space.notifyCredentialRevoked with JSON body:

    { "space": "<space URI>", "credentials": ["<jti>", "<jti>"] }

The credentials array contains 1–100 nonempty JWT IDs, not JWT strings. Require service auth with iss=space authority, aud=a repo account DID hosted by the receiving host, and lxm=com.atproto.space.notifyCredentialRevoked.

Receiving repo hosts persist revocations keyed by (space, jti), process repeated IDs/deliveries idempotently, and reject matching credentials with CredentialRevoked. Retain entries for at least 60 minutes and account for clock skew: Bluesky uses 3600 + 2*5 = 3610 seconds from receipt. Cleanup must not undermine retention.

Early revocation fanout is optional authority behavior; receiving/enforcing it is required for repo hosts. Short expiry remains the primary mechanism. Do not assume membership removal automatically sends revocations. Clients must stop retrying a revoked credential and only obtain a replacement through a still-authorized session.

3. Update write notifications and space catch-up.

Apply wire changes to existing producers/consumers of these APIs. The delivery and ongoing catch-up requirements apply to hosts and syncers implementing those responsibilities; an on-demand reader or utility does not need to become a sync service.

Distinguish per-repo repoRev from the space-wide spaceRev; both are TIDs. Rename rev to repoRev specifically in notifyWrite bodies and listRepos entries. Preserve rev in repo commits and other APIs that still define it.

Repo host -> space host notifyWrite body:

    { space, repo, repoRev, hash }

Space host -> syncer notifyWrite body:

    { space, repo, repoRev, hash, spaceRev, prevSpaceRev? }

Only the space host assigns space revisions. Forwarded notifications include spaceRev; omit prevSpaceRev on the first update. hash remains Lexicon bytes with its existing meaning.

Repo hosts notify the authority automatically after writes, without registration. Resolve #atproto_space_host, falling back to the PDS endpoint only when that service entry is absent. Use service auth from the writer account (iss=repo), lxm=com.atproto.space.notifyWrite, and aud=<authority DID>#atproto_space_host. The reference receiver also accepts the bare authority DID. Forwarded notifications instead use the authority as issuer and the registered syncer service identifier as audience; validate each hop accordingly.

Space hosts check the writer's authorization, ignore repoRev <= the last accepted revision for that repo without resequencing/forwarding it, and reject repo revisions more than five minutes in the future with FutureRev. Atomically update writer metadata and allocate a strictly increasing spaceRev across all writers, with prevSpaceRev referencing the preceding accepted space update. Unknown/deleted spaces return SpaceNotFound.

For syncers using notifications, register/unregister on the space host for the whole space, using a space credential; renew according to the registration's expiresAt. Syncers fetch actual repo data directly from repo hosts. Existing polling-only tools can continue polling with the updated API semantics.

The exact catch-up API is com.atproto.space.listRepos({ space, cursor?, limit? }):

- cursor is an exclusive space-revision checkpoint. There is no separate since parameter.
- Each entry is { did, repoRev, hash, spaceRev }, ordered by ascending spaceRev.
- A nonempty page returns cursor = its final entry's spaceRev, even for a short page. Continue until an empty page; that page omits cursor.
- Preserve the previous checkpoint when an empty page omits cursor. There is no top-level spaceRev response field.
- Listings contain latest writer states, not a historical event log. A repo can reappear if updated during pagination; process it idempotently.

For persistent syncers, persist a safely processed per-space checkpoint. On a gap in prevSpaceRev or after downtime, catch up through listRepos from that checkpoint and sync the affected repos. Handle duplicate/out-of-order notifications without moving checkpoints backward or skipping gaps. Do not advance a checkpoint past work that would be lost on a crash. Old DID-based listing cursors cannot be reused as space revisions; rebootstrap affected checkpoints where present.

For repo-host delivery, persist retryable failures, coalesce to the latest state per (repo, space), retry network/transient HTTP failures with backoff, and stop on permanent failures. Bluesky retries for up to 24 hours per newer revision, resets backoff/deadline on newer state, and coordinates workers with an expiring lease. Space-host -> syncer delivery is reasonable-effort, so keep catch-up. The reference sender has a commit-to-retry-persistence crash window; do not describe it as guaranteed delivery or remove an existing stronger outbox design.

4. Apply request-field renames.

Use spaceType instead of type in the com.atproto.space.listSpaces query filter and the com.atproto.simplespace.createSpace request body. Update callers, generated bindings, filtering, and authorization checks. This is a scoped wire-field rename, not a global rename of internal type fields or OAuth permission syntax.

5. Align simplespace read/write permissions where applicable.

Update existing management callers, models, schemas, or handlers. Only projects acting as a managing app need to implement checkUserAccess, and only hosts enforce the policies. Do not add space-management features to a project that does not offer them.

Replace a single policy with independent readPolicy and writePolicy. Use the actual Lexicon union objects: publicPolicy, memberListPolicy, or managingAppPolicy; managingApp belongs inside the managingAppPolicy object. createSpace requires both policies plus appAccess and spaceType. updateSpace leaves omitted fields unchanged. Reject unsupported policy/appAccess variants.

Replace addMember with putMember({ space, did, read, write }); both booleans are required and replaced together. listMembers entries contain { did, read, write }.

Read permission controls credential issuance, together with appAccess. Write permission controls whether the authority tracks a writer in listRepos and forwards notifications. It does not prevent the account writing into its own repo. appAccess does not apply to write notifications.

Existing managing-app implementations update checkUserAccess to accept { space, user, access: "read" | "write", clientId? }, returning { authorized }. Validate service auth from the authority. clientId is attested when present and is omitted for write checks. If the project stores policies/member permissions, audit their migration explicitly to preserve intended access.

6. Verify and report.

Validate the changed surface in proportion to what this project owns. For a small app or dependency-only update, run its available build/typecheck and focused tests or smoke check of the existing flow. Do not build an upstream protocol test suite, add a test framework, or provision server infrastructure solely for this migration.

For projects implementing affected protocol behavior themselves, choose regression tests for those changes from: both signature flows; optional alg/keyid; high-S acceptance and DER rejection; changed token/wrong key/wrong audience/duplicate headers; reusable credential signatures but single-use delegations; lifetime boundaries and revocation authorization/persistence/idempotency; independent read/write policies; spaceType filtering and permission enforcement; revision ordering, duplicate/future notifications, gap recovery, repeated repos during pagination, empty-page checkpoint preservation, and retry/restart behavior. This is a menu, not a required suite for every project.

Apply schema/state migrations only where this project owns affected persisted state, and regenerate only bindings it maintains, using its normal tooling. Audit already-applied migrations rather than assuming replacing a migration file upgrades an existing database. Run applicable existing checks. Finish with a concise summary of what applied, exact dependency versions changed, validation results, and any necessary migration steps or blockers. Group irrelevant requirements briefly; a no-change result with evidence is valid. Stop once the project's existing functionality is compatible.
