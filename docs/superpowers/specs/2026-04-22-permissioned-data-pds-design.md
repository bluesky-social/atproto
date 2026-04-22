# Permissioned Data: PDS Implementation Design

## Overview

This spec covers the PDS implementation of ATProto's permissioned data protocol ("spaces"). A space is an authorization and sync boundary for permissioned records representing a shared social context. It includes many record types from many users, each storing their own records on their own PDS.

This work covers four subsystems:
1. **Record CRUD** — permissioned repo operations exposed as XRPC endpoints
2. **Space management** — creating spaces, managing member lists
3. **Space credentials** — stateless authorization tokens for read access
4. **Sync** — oplog-based incremental sync with full-resync fallback

Out of scope: application coordination (allow/deny lists, managing app routing), delegated/sub-accounts.

### Goals

- Get a feel for using the full protocol end-to-end
- Nail down protocol details and flag spec questions
- Mirror `@atproto/repo` patterns where they make sense, diverge where they don't
- Not production-ready — focused on correctness and protocol exploration

### Spec questions and TODOs

Items flagged throughout the doc that need eventual spec decisions:

- **URI scheme**: Using `ats://<ownerDid>/<spaceType>/<spaceKey>` for now. Scheme and format may evolve.
- **SetHash algorithm**: Currently XOR placeholder. Will switch to ECMH or ltHash before production.
- **Credential expiration window**: Spec says 2-4 hours. Exact default TBD.
- **Oplog retention policy**: How long must a PDS keep oplog entries? Currently unspecified — "backfill window" is vague.
- **notifyWrite fan-out failure**: What happens when the space owner can't reach a syncing app? Currently fire-and-forget. May need retry/backoff policy.
- **Member grant signing key**: The grant is signed by the user's atproto signing key, mirroring service auth. The member's PDS facilitates issuance since it holds the OAuth session, but the token is from the user.
- **Service endpoint for notifications**: How does the space owner learn a syncing app's notification endpoint? Resolved from the app's DID doc, or provided in the credential request? TBD.
- **Write before membership**: A user can write records to any space URI on their own PDS without being a member. Enforcement is at the read boundary. Is this the right UX, or should the PDS guard against accidental writes to non-member spaces?

---

## 1. Data Model & Storage

### Space identity

A space is identified by a URI: `ats://<ownerDid>/<spaceType>/<spaceKey>`.

Example: `ats://did:plc:abc123/app.bsky.group/default`

The three components:
- **Owner DID** — the DID that serves as root of trust for the space
- **Space type** — an NSID describing the modality (e.g. `app.bsky.group`)
- **Space key** — an arbitrary string differentiating multiple spaces of the same type under the same owner

### Actor store tables

Each user's per-actor SQLite database gets these tables:

**`space`** — spaces this user participates in or owns
| Column | Type | Description |
|--------|------|-------------|
| `uri` | varchar, PK | Space URI |
| `isOwner` | integer (boolean) | Whether this actor owns the space |
| `memberSetHash` | blob, nullable | SetHash commitment over member DIDs (owner only) |
| `memberRev` | varchar, nullable | Member list revision (owner only) |
| `createdAt` | varchar | Timestamp |

**`space_repo`** — this user's permissioned repo state per space
| Column | Type | Description |
|--------|------|-------------|
| `space` | varchar, PK | Space URI (FK to space) |
| `setHash` | blob, nullable | Current SetHash digest over records |
| `rev` | varchar, nullable | Current revision (TID) |

**`space_record`** — records in permissioned repos
| Column | Type | Description |
|--------|------|-------------|
| `space` | varchar | Space URI |
| `collection` | varchar | Collection NSID |
| `rkey` | varchar | Record key |
| `cid` | varchar | Record CID |
| `value` | blob | CBOR-encoded record |
| `repoRev` | varchar | Rev at which this record was written |
| `indexedAt` | varchar | Timestamp |

Primary key: `(space, collection, rkey)`. Index on `(space, repoRev)`.

**`space_member`** — member list for owned spaces
| Column | Type | Description |
|--------|------|-------------|
| `space` | varchar | Space URI |
| `did` | varchar | Member DID |
| `memberRev` | varchar | Rev at which this member was added |
| `addedAt` | varchar | Timestamp |

Primary key: `(space, did)`.

**`space_record_oplog`** — record operation log for sync
| Column | Type | Description |
|--------|------|-------------|
| `space` | varchar | Space URI |
| `rev` | varchar | TID for this operation |
| `action` | varchar | create / update / delete |
| `collection` | varchar | Collection NSID |
| `rkey` | varchar | Record key |
| `cid` | varchar, nullable | Current CID (null for delete) |
| `prev` | varchar, nullable | Previous CID (null for create) |

Primary key: `(space, rev)`. Ordered by rev for `since` queries.

**`space_member_oplog`** — member list operation log (owner only)
| Column | Type | Description |
|--------|------|-------------|
| `space` | varchar | Space URI |
| `rev` | varchar | TID for this operation |
| `action` | varchar | add / remove |
| `did` | varchar | Member DID |

Primary key: `(space, rev)`.

**`space_credential_recipient`** — tracks services issued credentials (for notification fan-out)
| Column | Type | Description |
|--------|------|-------------|
| `space` | varchar | Space URI |
| `serviceDid` | varchar | DID of the service |
| `serviceEndpoint` | varchar | Where to send notifications |
| `lastIssuedAt` | varchar | Timestamp of last credential issuance |

Primary key: `(space, serviceDid)`.

### Oplog entry granularity

Each individual operation (create, update, delete, add, remove) gets its own unique rev (TID) in the oplog. A batch `applyWrites` call with 3 operations produces 3 oplog entries with 3 sequential TIDs. The `space_repo.rev` (or `space.memberRev`) is set to the latest TID in the batch.

### Membership lifecycle on the member's PDS

When a member's PDS receives `notifyMembership` with `isMember: true`, it creates a `space` entry with `isOwner: false`. This is necessary so the PDS knows to accept space credentials for that space and serve permissioned repo data to authorized requesters. When `isMember: false`, the PDS may mark the space as inactive or remove it.

The PDS does not enforce membership at write time — a user can write records scoped to any space URI on their own PDS. Membership enforcement happens at the read/sync boundary: applications check the member list when consuming data.

### Key design decisions

- **`space` vs `space_repo` split**: Space metadata (ownership, member list commitment) is separate from the user's permissioned repo state (record setHash, rev). The space owner tracks the member list commitment on the `space` table; every participant tracks their repo commitment on `space_repo`.
- **Parallel oplog tables**: `space_record_oplog` and `space_member_oplog` are symmetric structures serving the same sync pattern but for different data.
- **Member list is just DIDs**: No read/write distinction. The member list defines a read-access boundary. Write semantics are application-level, enforced by consumers (analogous to how blocks/threadgates work in public atproto).

---

## 2. `@atproto/space` Package

### Package structure

```
src/
  index.ts
  types.ts
  error.ts
  set-hash.ts
  commit.ts
  util.ts
  space-repo.ts
  space-members.ts
  credential.ts
  storage/
    types.ts
    memory-repo-storage.ts
    memory-members-storage.ts
```

### Shared primitives

**SetHash** (`set-hash.ts`) — order-independent set digest. Currently XOR-of-SHA256-hashes (placeholder for ECMH). Used by both SpaceRepo and SpaceMembers.

**Commit** (`commit.ts`) — `createCommit(setHash, context, keypair)` / `verifyCommit(context, commit)`. Shared by both constructs. Uses HKDF to derive an HMAC key from random IKM, with space context as info. Provides deniability — each commit uses fresh IKM.

**SpaceContext** — the HKDF info used for domain separation:
```ts
type SpaceContext = {
  spaceDid: string
  spaceType: string
  spaceKey: string
  userDid: string
  scope: 'records' | 'members'
  rev: string
}
```

The `scope` field ensures a record commit can't be confused with a member list commit.

### SpaceRepo class (`space-repo.ts`)

Manages a single user's permissioned repo within a space.

**Factory methods:**
- `SpaceRepo.create(storage)` — new empty repo
- `SpaceRepo.load(storage)` — load from storage, recompute setHash if missing
- `SpaceRepo.loadOrCreate(storage)` — load or create

**Write operations:**
- `formatCommit(writes: RecordWriteOp[])` — validate writes, compute updated setHash, return `CommitData` (does not persist)
- `applyCommit(commit: CommitData)` — persist to storage
- `applyWrites(writes: RecordWriteOp[])` — convenience: formatCommit + applyCommit

**Read operations:**
- `getRecord(collection, rkey)` — fetch single record
- `listRecords(collection)` — all records in a collection
- `listCollections()` — all collections with records

**SetHash element format:** `"collection/rkey:cid"` — the record's identity includes its content hash.

### SpaceMembers class (`space-members.ts`)

Manages the member set for a space (space owner only).

**Factory methods:**
- `SpaceMembers.create(storage)` / `.load(storage)` / `.loadOrCreate(storage)`

**Write operations:**
- `formatCommit(ops: MemberWriteOp[])` — validate ops, compute updated setHash, return `MemberCommitData`
- `applyCommit(commit: MemberCommitData)` — persist
- `addMember(did)` / `removeMember(did)` — convenience wrappers

**Read operations:**
- `getMembers()` — all member DIDs
- `isMember(did)` — membership check

**SetHash element format:** the DID string directly.

### SpaceCredential / MemberGrant (`credential.ts`)

**MemberGrant** — issued by member's PDS, presented to space owner to obtain a credential. Mirrors service auth token pattern.

JWT payload:
```ts
{
  iss: string       // member DID
  aud: string       // space owner DID
  space: string     // space URI
  clientId: string  // OAuth client ID of requesting app
  lxm: string       // "com.atproto.space.getSpaceCredential"
  iat: number
  exp: number       // short-lived, ~5 minutes
}
```
Signed by the user's atproto signing key. The `lxm` field binds the grant to the credential issuance endpoint, preventing replay against other endpoints.

**SpaceCredential** — issued by space owner, presented to member PDSes for read access.

JWT payload:
```ts
{
  iss: string       // space owner DID
  space: string     // space URI
  clientId: string  // OAuth client ID
  iat: number
  exp: number       // 2-4 hours
}
```
Signed by the space owner's atproto signing key. Verifiable by any PDS by resolving the space owner's DID doc.

**Functions:**
- `createMemberGrant(opts, signingKey)` / `verifyMemberGrant(jwt, memberPubKey)`
- `createSpaceCredential(opts, signingKey)` / `verifySpaceCredential(jwt, spaceOwnerPubKey)`

### Storage interfaces

```ts
interface SpaceRepoStorage {
  getRecord(collection: string, rkey: string): Promise<RepoRecord | null>
  hasRecord(collection: string, rkey: string): Promise<boolean>
  listCollections(): Promise<string[]>
  listRecords(collection: string): Promise<{ rkey: string; record: RepoRecord }[]>
  getSetHash(): Promise<Buffer | null>
  applyCommit(commit: CommitData): Promise<void>
  destroy(): Promise<void>
}

interface SpaceMembersStorage {
  getMembers(): Promise<string[]>
  isMember(did: string): Promise<boolean>
  getSetHash(): Promise<Buffer | null>
  applyCommit(commit: MemberCommitData): Promise<void>
  destroy(): Promise<void>
}
```

Both have in-memory implementations for testing. The PDS provides SQLite-backed implementations.

---

## 3. XRPC Endpoints

All endpoints live under `com.atproto.space.*`.

### Record CRUD

Called by the user's app on the user's PDS. Auth: standard OAuth.

| Endpoint | Type | Description |
|----------|------|-------------|
| `createRecord` | procedure | Create a record in a permissioned repo |
| `putRecord` | procedure | Create or update a record |
| `deleteRecord` | procedure | Delete a record |
| `getRecord` | query | Get a single record (dual auth: user OAuth or space credential) |
| `listRecords` | query | List records in a collection (dual auth) |
| `applyWrites` | procedure | Batch write operations |

Every request includes a `space` parameter (the space URI). The PDS looks up the space in the actor store and operates on the corresponding SpaceRepo.

After a write, the user's PDS calls `notifyWrite` on the space owner's PDS (fire-and-forget).

### Space management

Called by the space owner's app on the space owner's PDS. Auth: standard OAuth.

| Endpoint | Type | Description |
|----------|------|-------------|
| `createSpace` | procedure | Create a new space |
| `getSpace` | query | Get space metadata |
| `listSpaces` | query | List spaces owned by or joined by this account |
| `addMember` | procedure | Add a DID to the member list |
| `removeMember` | procedure | Remove a DID from the member list |
| `getMembers` | query | List all members of a space |

Only the space owner can call `addMember` / `removeMember`. After a member change, the space owner's PDS calls `notifyMembership` on the affected member's PDS.

### Credential flow

| Endpoint | Called on | Called by | Description |
|----------|-----------|-----------|-------------|
| `getMemberGrant` | Member's PDS | App (with member's OAuth token) | Returns a grant token (JWT) scoped to space + client ID |
| `getSpaceCredential` | Space owner's PDS | App (with grant token) | Exchanges grant for a signed space credential JWT |

**Flow:**
1. App has OAuth session with a member user (bound to a client ID)
2. App calls `getMemberGrant` on member's PDS -> gets a short-lived grant token
3. App calls `getSpaceCredential` on space owner's PDS with the grant token
4. Space owner verifies: member is in member list, grant signature valid, `lxm` matches
5. Space owner returns a space credential JWT
6. Space owner records the app's service DID + endpoint in `space_credential_recipient` (endpoint resolved from the app's DID doc, or provided in the request — @TODO: decide which)

### Sync

| Endpoint | Called on | Auth | Description |
|----------|-----------|------|-------------|
| `getRepoState` | Member's PDS | Space credential | Get current setHash + rev for a user's permissioned repo |
| `getRepoOplog` | Member's PDS | Space credential | Get record operations since a given rev. Response includes current commit info (setHash + rev) |
| `getMemberState` | Space owner's PDS | Space credential | Get current member list setHash + rev |
| `getMemberOplog` | Space owner's PDS | Space credential | Get member list operations since a given rev. Response includes current commit info |

### Notifications

| Endpoint | Direction | Auth | Description |
|----------|-----------|------|-------------|
| `notifyMembership` | Space owner -> member's PDS | Service auth | Notify member's PDS of membership change |
| `notifyWrite` | Member's PDS -> space owner's PDS -> syncing apps | Service auth | Notify that a member has written new data |

`notifyWrite` is the same endpoint on both the space owner's service and syncing apps. The space owner relays the notification by looking up `space_credential_recipient` and calling the same endpoint on each service.

---

## 4. PDS Wiring

### Actor store integration

**SpaceReader** (`actor-store/space/reader.ts`) — read-only queries:
- `getSpace(uri)`, `listSpaces(opts)`
- `getRecord(space, collection, rkey, cid?)`, `hasRecord(space, collection, rkey)`
- `listRecords(space, collection, opts)`, `listCollections(space)`
- `getMembers(space)`, `isMember(space, did)`
- `getRepoState(space)` -> `{ setHash, rev }`
- `getMemberState(space)` -> `{ setHash, rev }`
- `getRepoOplog(space, since, limit)` -> `{ ops[], rev, setHash }`
- `getMemberOplog(space, since, limit)` -> `{ ops[], rev, setHash }`

**SpaceTransactor** (`actor-store/space/transactor.ts`, extends SpaceReader) — writes:
- `createSpace(uri, isOwner)`
- `applyRepoCommit(space, commitData)` — writes records, updates setHash/rev, appends to `space_record_oplog`
- `applyMemberCommit(space, memberCommitData)` — writes members, updates memberSetHash/memberRev, appends to `space_member_oplog`
- `deleteSpace(uri)`

**SqlRepoStorage** (`actor-store/space/sql-repo-storage.ts`) — implements `SpaceRepoStorage` from `@atproto/space`, backed by actor store SQLite. Allows `SpaceRepo` to operate on real persistence.

**SqlMembersStorage** (`actor-store/space/sql-members-storage.ts`) — implements `SpaceMembersStorage` from `@atproto/space`, backed by actor store SQLite.

### Auth verification

The PDS auth verifier gets new paths:

- **User auth** — existing OAuth flow. Used for record CRUD and space management on user's own PDS.
- **Space credential auth** — new. Verifies a JWT space credential for sync endpoints. Resolves space owner's DID doc, checks signing key, validates expiration, confirms requested space matches credential's `space` claim.
- **Service auth** — existing pattern. Used for inter-PDS notifications (`notifyWrite`, `notifyMembership`).

### Request flow: user creates a record

1. App calls `com.atproto.space.createRecord` on user's PDS (OAuth auth)
2. PDS opens actor store transaction
3. Loads `SpaceRepo` via `SqlRepoStorage` for that space
4. `repo.formatCommit([{ action: 'create', collection, rkey, record }])`
5. `transactor.applyRepoCommit(space, commitData)` — persists record, updates setHash/rev, appends oplog entry
6. PDS calls `notifyWrite` on space owner's PDS (fire-and-forget)
7. Returns `{ uri, cid, commit: { rev } }`

### Request flow: app obtains a space credential

1. App calls `getMemberGrant` on member's PDS (OAuth auth, bound to client ID)
2. Member's PDS creates a grant JWT (iss: member DID, aud: space owner DID, space, clientId, lxm)
3. App calls `getSpaceCredential` on space owner's PDS with the grant
4. Space owner's PDS verifies grant signature (resolves member's DID doc), checks member is in member list, checks lxm
5. Space owner's PDS creates and returns a space credential JWT
6. Space owner's PDS records app's service DID + endpoint in `space_credential_recipient`

### Request flow: app syncs a member's repo

1. App calls `getRepoOplog` on member's PDS with space credential + `since` rev
2. PDS verifies space credential (resolves space owner's DID doc, checks signature/expiration)
3. PDS confirms the user participates in the requested space
4. Returns `{ ops: [...], rev, setHash }`
5. App replays ops locally, fetches new/updated record content via `getRecord` as needed
6. App computes setHash from its local state, compares to returned `setHash`
7. If mismatch -> full resync via `listRecords`, recompute from scratch

### Request flow: space owner adds a member

1. App calls `addMember` on space owner's PDS (OAuth auth)
2. PDS loads `SpaceMembers` via `SqlMembersStorage`
3. `members.formatCommit([{ action: 'add', did }])`
4. `transactor.applyMemberCommit(space, commitData)` — persists member, updates memberSetHash/memberRev, appends member oplog entry
5. PDS calls `notifyMembership` on the new member's PDS (fire-and-forget)
6. Returns success

---

## 5. Testing Strategy

### Layer 1: `@atproto/space` package unit tests

Extend the existing test suite:

- **SpaceRepo**: CRUD, batch writes, formatCommit/applyCommit, setHash correctness, error cases
- **SpaceMembers**: add/remove, setHash over DIDs, commit signing/verification, duplicate add, remove non-member
- **SetHash**: order independence, add/remove inverse, consistency across both usages
- **Commit domain separation**: a commit signed with `scope: 'records'` fails verification with `scope: 'members'`
- **Credential/Grant**: create, verify, reject expired, reject wrong space, reject tampered, verify `lxm` binding

### Layer 2: PDS integration tests

Spin up a real PDS instance using existing test infrastructure. Test XRPC endpoints directly.

**Record CRUD:**
- Create/get/put/delete/list records via XRPC
- applyWrites batch operations
- Verify rev advances on each write
- Verify setHash correctness after operation sequences

**Space management:**
- Create space, verify listSpaces
- Add/remove members, verify getMembers
- Auth rejection for non-owner calling addMember/removeMember

**Credential flow:**
- Member obtains grant from their PDS
- Exchange grant for credential on space owner's PDS
- Rejected if member not in member list
- Rejected if expired
- Rejected if client ID mismatch

### Layer 3: Multi-PDS sync tests

Spin up multiple PDS instances to simulate real protocol flows. Test infrastructure may need adaptation.

**Setup:** Two PDSes (PDS-A hosts space owner + member-1, PDS-B hosts member-2). A test client acting as the syncing application.

**Happy path sync:**
1. Space owner creates space, adds members
2. Members write records on their respective PDSes
3. App obtains space credential via grant flow
4. App syncs member list from space owner's PDS
5. App syncs records from each member's PDS
6. Verify complete, consistent view — setHash matches everywhere

**Incremental sync:**
1. After initial sync, members write more records
2. App syncs with `since` — verify only new ops, setHash still matches

**Sync recovery:**
1. Simulate oplog gap (compact/flush oplog entries)
2. App attempts incremental sync, setHash mismatch after replay
3. App falls back to full resync via listRecords
4. Verify consistent state after recovery

**Member lifecycle:**
1. Space owner removes a member mid-sync
2. App syncs member list, sees removal
3. Verify credential/access behavior for removed member

**Notification flow:**
1. Member writes -> notifyWrite reaches space owner -> relayed to app
2. Verify notification delivery (mock app endpoint)

### What we're NOT testing
- ECMH (XOR placeholder only)
- Application-level write semantics
- Delegated accounts / app coordination
- Performance at scale
