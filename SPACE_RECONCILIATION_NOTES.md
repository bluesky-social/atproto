# Space / Permissioned Data — Reconciliation with Proposal 0016

Working notes for bringing the `permissioned-data` branch in line with proposal 0016
(`../proposals/0016-permissioned-data/README.md`). This is a scratch doc for review;
delete once the work is reviewed and merged.

## Marching orders (from dholms)

1. **Member list**: rip out the commit/oplog/state machinery. The proposal demotes the
   member list to plain host-internal state ("not a synced protocol structure and is not
   enumerated to the network"). Member list becomes a plain table consulted only at
   credential-mint time.
2. **Client attestation**: plumbing + structural only. Wire it through `getSpaceCredential`,
   parse + structurally validate, extract `client_id`. JWKS-fetch-and-verify is a documented
   TODO, not implemented this pass.
3. **OAuth scope grammar**: all three changes — add `read_self`, split `manage` into its own
   `manage=` query param, default `collection` to the space type's declared collections.
4. **End state**: everything green — lib + handlers + storage + scopes reconciled, package
   builds, `@atproto/space` unit tests pass, `packages/pds` spaces.test.ts + space-scope.test.ts
   pass, dev-env wiring works.

## Terminology (settled in phase 1)

- **authority** = the space's DID (`spaceDid`) and the space host it resolves to. Protocol-level.
- **owner** = the user/account that controls the space. Management-layer (simplespace). Valid term.
- **author** = the DID that wrote a given record (URI 4th segment, currently `userDid`).

## Method renames (lexicon → impl)

| Old impl handler | New (proposal/lexicon) |
|---|---|
| `getAccessGrant` / `getMemberGrant` | `getDelegationToken` |
| `getRepoOplog` | `listRepoOps` |
| `getMemberOplog` | (removed — member list not synced) |
| `getMemberState` | (removed) |
| `getMembers` | `simplespace.listMembers` |
| `updateSpaceConfig` | `simplespace.updateSpace` |
| `notifyMembership` | (removed — member list not synced) |
| `getSpace` | `getSpace` (kept; moves config to simplespace union) |
| `addMember` / `removeMember` / `createSpace` / `deleteSpace` | `simplespace.*` |
| (new) | `registerNotify`, `simplespace.checkUserAccess` |

## Decision log

(decisions made during execution, with rationale — for review)

### D1 — namespace split: com.atproto.space vs com.atproto.simplespace
The current impl puts everything under `com.atproto.space.*` (createSpace, addMember, etc.).
The lexicons split protocol methods (`space.*`) from the management implementation
(`simplespace.*`). Handlers and registration must be reorganized to match.

### D2 — commit ctx simplified to match proposal
Proposal §"Commit signature": ctx = "atproto-space-v1" ‖ u16(len(space))‖space ‖
u16(len(rev))‖rev ‖ u16(len(ikm))‖ikm, where `space` is the 3-part space URI
(ats://authority/type/skey). The old code decomposed the space into spaceDid/type/key,
added userDid, and a `scope: 'records'|'members'` domain separator, and excluded ikm from
the signed context (it signed ikm separately). Now: ikm is part of ctx, sig covers ctx,
mac = HMAC(HKDF(ikm, ctx), hash). Dropped `scope`/`userDid` — members are no longer
committed and the author is identified out-of-band by whose repo is being fetched.
`SpaceContext` is now `{ space: string; rev: string }`.

### D3 — record element format
Proposal §"Commit digest": element = UTF-8 of `{collection}/{rkey}/{record_cid}`.
Old code used `{collection}/{rkey}:{cid}` (colon). Changed to slash to match proposal.
NOTE: this changes every LtHash digest, so the empty-repo and known-digest test vectors
in space.test.ts and lthash.test.ts change. Updated those.

### D5 — added createClientAttestation helper to @atproto/space
The proposal describes client attestations as built by the app, but apps still need a way
to build them and tests need to exercise the shape. Added `createClientAttestation()`
alongside `parseClientAttestation()`. JWKS verification remains a documented TODO (the
authority would resolve client_id metadata → JWKS → verify sig by kid).

### D6 — member list demotion: behavioral model on the member/writer PDS
Old model: owner `addMember` → `notifyMembership` to the member's PDS → creates a local
`space` row with `isMember=1` + `space_repo`. The member could only write after being added.
`listSpaces` returned `isOwner OR isMember`.

New model (per proposal — member list is the authority's internal concern, not synced):
- A writer's PDS creates the local `space` row + `space_repo` lazily on first write
  (createRecord/putRecord/applyWrites) if absent. No "membership" notification required.
- Removed `isMember` cache column and `notifyMembership` entirely.
- `listSpaces` = "spaces the caller holds a repo in" → all non-deleted local space rows.
- `space_member` (on the authority) becomes a plain table consulted only at mint time.

### D7 — config schema: mintPolicy + appAccess
Replaced the old `isPublic`(bool) + `appAccessMode`(allow/deny) + `appExceptions`(json) columns
with the proposal's model:
- `mintPolicy` varchar: 'public' | 'member-list' (default) | 'managing-app'
- `appAccessType` varchar: 'open' (default) | 'allowList'  (the #open/#allowList union tag)
- `appAllowed` text (json array): the allowList client_ids
- `managingApp` varchar null: unchanged

### D8 — migrations rewritten in place (not append-only)
The entire space feature is new on this branch (migrations 002-004 were all added here and have
never shipped). Rather than pile a 005 onto a schema that only exists on this branch, I rewrote
002 + 003 to land the final schema and deleted 004 (config folded into the `space` table in 002).
Actor-store sqlite DBs are per-actor and ephemeral in dev/test, so in-place rewrite is safe and
much cleaner. If any long-lived dev DBs exist they should be recreated.

### D9 — space credential verification key (#atproto_space) — DEFERRED (dholms)
Per proposal the space credential is signed by the authority's `#atproto_space` verification
method and the delegation token by the user's `#atproto`. In simplespace the authority is the
user's own DID and (in dev) the same keypair backs both, so the verifier currently resolves the
`#atproto` key for both. RESOLVED (dholms): leave as TODO — fine for simplespace, which is the
only implementation that exists. Revisit (resolve `#atproto_space` with fallback to `#atproto`,
plus sign with that key) when a dedicated space-authority implementation lands. TODO marker is in
auth-verifier.ts.

### D10 — listRepos backed by a real writer set (DONE)
RESOLVED: built the proposal-correct writer set. New `space_writer` table (space, did, rev) on
the authority, in migration 002. The `notifyWrite` handler now calls `recordWriter(space, repo,
rev)` when the authority receives a write notification, upserting/advancing the writer's rev.
`listRepos` reads `listWriters` instead of the member list, so it enumerates accounts that have
actually written (not members who haven't), independent of the member list. Co-located writers
populate it too, since write handlers fire notifyWrite to the authority regardless of co-location.
`purgeOwnerSpaceData` clears it on space deletion. Covered by a spaces.test.ts test that writes
from a remote PDS and polls listRepos (notifyWrite is best-effort/async) — asserts the writer
appears and a non-writing member (alice) does not.

### D11 — registerNotify expiry (SETTLED: 24h fixed)
registerNotify records the caller (space credential's iss = authority, or the requesting
service) as a credential recipient and returns an expiry. Baseline expiry = 24h from now,
renewable by re-calling. RESOLVED (dholms): keep the fixed 24h default; not configurable for now.

### Pre-existing build errors (NOT mine — dholms to handle separately)
`pnpm exec tsc --build` on packages/pds reports two errors in files I never touched:
- `src/account-manager/oauth-store.ts(80)`: OAuthStore missing `updateHandle` (AccountStore iface)
- `src/context.ts(376)`: `idResolver` not in `OAuthProviderOptions`
These look like an oauth-provider version skew already present on the branch. RESOLVED (dholms):
leave for dholms to handle separately (possibly mid-flight branch work). NOTE: these surface only
under the test/strict tsconfig — `pnpm build` (tsconfig.build.json) passes clean, and all space
tests run green. They do block a fully-green `tsc --build tsconfig.tests.json`.

### D12 — scope grammar: read_self + manage= split
`SpaceAction` is now `read_self | read | create | update | delete` (manage removed). `manage`
is its own multi-valued query param with verbs `create | update | delete`, default empty.
Match shapes:
- `{ action: 'read' }` — whole-space read, collection-independent. Satisfied by a grant listing `read`.
- `{ action: 'read_self', collection }` — own-repo read, collection-constrained. Satisfied by `read` OR `read_self`.
- `{ action: 'create'|'update'|'delete', collection }` — write, collection-constrained.
- `{ manage: 'create'|'update'|'delete' }` — space admin, collection-independent.
Omitting `action` defaults to `read,create,update,delete` (read implies read_self). `manage` is
never implied by an action grant.

### D13 — collection defaults: expand at token-issuance (DONE)
The proposal says an omitted `collection` defaults to the space type's declared collections.
The runtime matcher is context-free (no lexicon resolution), so it can't expand defaults itself.

RESOLVED: implemented expand-at-grant-time, exactly mirroring how `include:` permission-set
scopes are already resolved. `LexiconManager.buildTokenScope` (oauth-provider) runs at token
issuance (initial grant + refresh); it already expands `include:<nsid>` into concrete scopes via
the lexicon resolver. Added a second pass, `expandSpaceCollections`, that finds concrete
`space:<type>` scopes with no `collection`, resolves the space declaration, and materializes its
`collections` into the stored scope string. So `space:com.atmoboards.forum` is stored as
`space:com.atmoboards.forum?collection=com.atmoboards.thread&collection=com.atmoboards.reply`.
- `collection=*` and explicit lists pass through unchanged.
- `type=*` has no declaration → left empty (matches proposal: cross-type grants confer no write
  targets unless provided).
- Declaration-resolution failure → scope left untouched (no silent broadening).
- Helpers `SpacePermission.hasCollections` / `withDefaultCollections()` added in oauth-scopes
  with unit tests; the matcher stays context-free.
The `include:` precedent (buildTokenScope already does resolution-at-issuance) is what made this
the obviously-right layer rather than threading async resolution into the matcher.

### D14 — action and manage are orthogonal (SETTLED: orthogonal)
RESOLVED (dholms): keep them fully orthogonal. `manage=` governs only management ops; `action`
independently defaults to `read,create,update,delete` when omitted, regardless of `manage`.
Each param means exactly one thing. To express "manage + read only" a client writes
`?action=read&manage=update&manage=delete`.

PROPOSAL FIX NEEDED: the 0016 example `space:com.atmoboards.forum?manage=update&manage=delete`
is annotated "with read access, but no record-write access" — that prose is inconsistent with the
orthogonal model (the scope as written grants the default record actions too). The proposal text
should be corrected to either drop that annotation or change the example to
`?action=read&manage=update&manage=delete`. Tracked here for a proposal-side edit.

### D15 — wired `space` into permission-set compilation (was a pre-existing gap)
include-scope.ts only handled `repo`/`rpc` resources; `space` permission-set entries silently
compiled to nothing (2 tests were already failing on the branch before my work). Added `space`
to parseLexPermission / toResourcePermission / isAllowedPermission / buildPermissions. The space
TYPE must be under the set's namespace authority and non-wildcard; COLLECTIONS may be wildcard or
cross-namespace (proposal 0016 line 462). Updated two test cases that asserted the opposite of the
proposal (they rejected cross-namespace/wildcard collections) — moved them to an "allows" block.

### D4 — commit signature verification
The old `verifyCommit(space, commit)` only verified the MAC (integrity vs context), never
the signature (authenticity). Per proposal a reader verifies sig against the user's signing
key AND recomputes the mac. Split into `verifyCommitMac(space, commit)` (symmetric, no key)
and `verifyCommitSig(space, commit, didKey)` (async, verifies sig over ctx). SpaceRepo's
verifyCommit still does hash+mac; sig verification is a separate call by the reader who
holds the author's DID key.

