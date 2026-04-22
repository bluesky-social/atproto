# Permissioned Data PDS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the PDS side of ATProto's permissioned data protocol — record CRUD, space management, space credentials, and oplog-based sync — exposed as XRPC endpoints.

**Architecture:** Mirror `@atproto/repo` patterns in `@atproto/space` (rename Repo→SpaceRepo, add SpaceMembers class). Extend PDS actor store with new tables (space_repo, space_member_state, oplogs, credential_recipient). Add XRPC endpoints for credential flow and sync. JWT-based space credentials with `typ` header discrimination.

**Tech Stack:** TypeScript, Kysely (SQLite migrations), XRPC/lexicons, JWT (manual encode/decode), `@atproto/crypto` for signing/verification.

**Spec:** `docs/superpowers/specs/2026-04-22-permissioned-data-pds-design.md`

---

## Phase 1: `@atproto/space` Package — Core Refactoring

### Task 1: Rename Repo → SpaceRepo

**Files:**
- Rename: `packages/space/src/repo.ts` → `packages/space/src/space-repo.ts`
- Modify: `packages/space/src/index.ts`
- Modify: `packages/space/tests/space.test.ts`
- Modify: `packages/pds/src/api/com/atproto/space/createRecord.ts`
- Modify: `packages/pds/src/api/com/atproto/space/putRecord.ts`
- Modify: `packages/pds/src/api/com/atproto/space/deleteRecord.ts`
- Modify: `packages/pds/src/api/com/atproto/space/applyWrites.ts`

- [ ] **Step 1:** Rename `packages/space/src/repo.ts` to `packages/space/src/space-repo.ts`. Inside the file, rename `class Repo` to `class SpaceRepo` and update all static method references (`Repo.create` → `SpaceRepo.create`, etc.).

- [ ] **Step 2:** Update `packages/space/src/index.ts`: change `export * from './repo'` to `export * from './space-repo'`.

- [ ] **Step 3:** Update `packages/space/tests/space.test.ts`: change all `Repo` imports and usages to `SpaceRepo`.

- [ ] **Step 4:** Update PDS endpoint files — replace `import { Repo` with `import { SpaceRepo` and update usages in `createRecord.ts`, `putRecord.ts`, `deleteRecord.ts`, `applyWrites.ts`.

- [ ] **Step 5:** Build and test.

Run: `cd packages/space && pnpm build && pnpm test`

- [ ] **Step 6:** Commit.

```bash
git add -A packages/space packages/pds/src/api/com/atproto/space
git commit -m "refactor: rename Repo to SpaceRepo in @atproto/space"
```

### Task 2: Rename SpaceStorage → SpaceRepoStorage, MemoryStorage → MemoryRepoStorage

**Files:**
- Rename: `packages/space/src/storage/memory-storage.ts` → `memory-repo-storage.ts`
- Modify: `packages/space/src/storage/types.ts`
- Modify: `packages/space/src/storage/index.ts`
- Modify: `packages/space/src/space-repo.ts`
- Modify: `packages/space/tests/space.test.ts`
- Modify: `packages/pds/src/actor-store/space/scoped-storage.ts`

- [ ] **Step 1:** In `packages/space/src/storage/types.ts`, rename `SpaceStorage` interface to `SpaceRepoStorage`.

- [ ] **Step 2:** Rename `memory-storage.ts` to `memory-repo-storage.ts`. Inside, rename `MemoryStorage` to `MemoryRepoStorage`, update `implements SpaceStorage` to `implements SpaceRepoStorage`.

- [ ] **Step 3:** Update `packages/space/src/storage/index.ts` exports.

- [ ] **Step 4:** Update `packages/space/src/space-repo.ts` to import `SpaceRepoStorage`.

- [ ] **Step 5:** Update test file imports.

- [ ] **Step 6:** Update `packages/pds/src/actor-store/space/scoped-storage.ts` — import `SpaceRepoStorage` instead of `SpaceStorage`.

- [ ] **Step 7:** Build and test.

Run: `cd packages/space && pnpm build && pnpm test`

- [ ] **Step 8:** Commit.

```bash
git add -A packages/space packages/pds/src/actor-store/space
git commit -m "refactor: rename SpaceStorage to SpaceRepoStorage"
```

### Task 3: Add scope to SpaceContext and member types

**Files:**
- Modify: `packages/space/src/types.ts`
- Modify: `packages/space/src/commit.ts`
- Modify: `packages/space/src/error.ts`
- Modify: `packages/space/tests/space.test.ts`

- [ ] **Step 1:** In `packages/space/src/types.ts`, add `scope: 'records' | 'members'` to `SpaceContext`. Add member types:

```ts
export enum MemberOpAction {
  Add = 'add',
  Remove = 'remove',
}

export type MemberAddOp = {
  action: MemberOpAction.Add
  did: string
}

export type MemberRemoveOp = {
  action: MemberOpAction.Remove
  did: string
}

export type MemberWriteOp = MemberAddOp | MemberRemoveOp

export type PreparedMemberOp = MemberAddOp | MemberRemoveOp

export type MemberCommitData = {
  ops: PreparedMemberOp[]
  setHash: Buffer
}
```

- [ ] **Step 2:** In `packages/space/src/commit.ts`, add `space.scope` to the `fields` array in `encodeCommitInfo`.

- [ ] **Step 3:** In `packages/space/src/error.ts`, add:

```ts
export class MemberAlreadyExistsError extends Error {
  constructor(did: string) {
    super(`Member already exists: ${did}`)
    this.name = 'MemberAlreadyExistsError'
  }
}

export class MemberNotFoundError extends Error {
  constructor(did: string) {
    super(`Member not found: ${did}`)
    this.name = 'MemberNotFoundError'
  }
}
```

- [ ] **Step 4:** In test file, add `scope: 'records'` to the `testSpace` constant.

- [ ] **Step 5:** Build and test.

Run: `cd packages/space && pnpm build && pnpm test`

- [ ] **Step 6:** Commit.

```bash
git add packages/space/src/types.ts packages/space/src/commit.ts packages/space/src/error.ts packages/space/tests/space.test.ts
git commit -m "feat: add scope to SpaceContext and member operation types"
```

### Task 4: Add SpaceMembersStorage and MemoryMembersStorage

**Files:**
- Modify: `packages/space/src/storage/types.ts`
- Create: `packages/space/src/storage/memory-members-storage.ts`
- Modify: `packages/space/src/storage/index.ts`

- [ ] **Step 1:** In `packages/space/src/storage/types.ts`, add:

```ts
export interface SpaceMembersStorage {
  getMembers(): Promise<string[]>
  isMember(did: string): Promise<boolean>
  getSetHash(): Promise<Buffer | null>
  applyCommit(commit: MemberCommitData): Promise<void>
  destroy(): Promise<void>
}
```

- [ ] **Step 2:** Create `packages/space/src/storage/memory-members-storage.ts`:

```ts
import { MemberCommitData, MemberOpAction } from '../types'
import { SpaceMembersStorage } from './types'

export class MemoryMembersStorage implements SpaceMembersStorage {
  private members = new Set<string>()
  private setHash: Buffer | null = null

  async getMembers(): Promise<string[]> {
    return [...this.members]
  }

  async isMember(did: string): Promise<boolean> {
    return this.members.has(did)
  }

  async getSetHash(): Promise<Buffer | null> {
    return this.setHash
  }

  async applyCommit(commit: MemberCommitData): Promise<void> {
    for (const op of commit.ops) {
      if (op.action === MemberOpAction.Add) {
        this.members.add(op.did)
      } else if (op.action === MemberOpAction.Remove) {
        this.members.delete(op.did)
      }
    }
    this.setHash = Buffer.from(commit.setHash)
  }

  async destroy(): Promise<void> {
    this.members.clear()
    this.setHash = null
  }
}
```

- [ ] **Step 3:** Update `packages/space/src/storage/index.ts` to export the new file.

- [ ] **Step 4:** Build.

Run: `cd packages/space && pnpm build`

- [ ] **Step 5:** Commit.

```bash
git add packages/space/src/storage/
git commit -m "feat: add SpaceMembersStorage interface and MemoryMembersStorage"
```

### Task 5: Create SpaceMembers class

**Files:**
- Create: `packages/space/src/space-members.ts`
- Modify: `packages/space/src/index.ts`

- [ ] **Step 1:** Create `packages/space/src/space-members.ts` implementing the SpaceMembers class. Pattern mirrors SpaceRepo — factory methods (create/load/loadOrCreate/recompute), formatCommit/applyCommit, convenience methods (addMember/removeMember), reads (getMembers/isMember). SetHash elements are DID strings directly (use `setHash.add(did)` rather than `formatRecordElement`).

- [ ] **Step 2:** Update `packages/space/src/index.ts` to add `export * from './space-members'`.

- [ ] **Step 3:** Build.

Run: `cd packages/space && pnpm build`

- [ ] **Step 4:** Commit.

```bash
git add packages/space/src/space-members.ts packages/space/src/index.ts
git commit -m "feat: add SpaceMembers class for member list management"
```

### Task 6: Add SpaceMembers and domain separation tests

**Files:**
- Modify: `packages/space/tests/space.test.ts`

- [ ] **Step 1:** Add `describe('SpaceMembers', ...)` block with tests:
- Creates and adds members, verifies getMembers
- Removes a member, verifies gone
- SetHash is order-independent (add A then B vs B then A)
- Remove reverses add for setHash
- Throws MemberAlreadyExistsError on duplicate add
- Throws MemberNotFoundError on remove of non-member
- Load recomputes setHash from storage

- [ ] **Step 2:** Add domain separation test under commits block: create a commit with `scope: 'records'`, verify it fails with `scope: 'members'` context.

- [ ] **Step 3:** Run tests.

Run: `cd packages/space && pnpm test`

- [ ] **Step 4:** Commit.

```bash
git add packages/space/tests/space.test.ts
git commit -m "test: add SpaceMembers and commit domain separation tests"
```

---

## Phase 2: `@atproto/space` Package — Credentials

### Task 7: Create credential.ts with JWT helpers

**Files:**
- Create: `packages/space/src/credential.ts`
- Modify: `packages/space/src/index.ts`
- Modify: `packages/space/package.json` (if `@atproto/common` needed)

- [ ] **Step 1:** Create `packages/space/src/credential.ts` with:

**MemberGrant functions:**
- `createMemberGrant(opts: { iss, aud, space, clientId }, keypair)` → JWT string
  - Header: `{ alg: keypair.jwtAlg, typ: "space_member_grant" }`
  - Payload: `{ iss, aud, space, clientId, lxm: "com.atproto.space.getSpaceCredential", iat, exp: iat + 5min, jti }`
  - Sign with keypair
- `verifyMemberGrant(jwt, didKey)` → parsed payload
  - Parse JWT, check `header.typ === "space_member_grant"`, verify signature, check expiration, check `lxm`

**SpaceCredential functions:**
- `createSpaceCredential(opts: { iss, space, clientId, expSeconds? }, keypair)` → JWT string
  - Header: `{ alg: keypair.jwtAlg, typ: "space_credential" }`
  - Payload: `{ iss, space, clientId, iat, exp: iat + (expSeconds ?? 2hours), jti }`
- `verifySpaceCredential(jwt, didKey)` → parsed payload
  - Parse JWT, check `header.typ === "space_credential"`, verify signature, check expiration

**Internal JWT helpers** (private to this module):
- `encodeJwt(header, payload, keypair)` → base64url-encoded JWT
- `parseJwt(jwt)` → `{ header, payload, signingInput, signature }`
- Use `@atproto/crypto`'s `Keypair.sign()` and `verifySignature()`.

Refer to `packages/lex/lex-server/src/service-auth.ts` lines 305-394 for the existing JWT parsing pattern (parseJwt function).

- [ ] **Step 2:** Update `packages/space/src/index.ts` to export credential module.

- [ ] **Step 3:** Build.

Run: `cd packages/space && pnpm build`

- [ ] **Step 4:** Commit.

```bash
git add packages/space/src/credential.ts packages/space/src/index.ts packages/space/package.json
git commit -m "feat: add space credential and member grant JWT utilities"
```

### Task 8: Add credential tests

**Files:**
- Modify: `packages/space/tests/space.test.ts`

- [ ] **Step 1:** Add `describe('credentials', ...)` block:
- Creates and verifies a member grant (roundtrip with keypair)
- Creates and verifies a space credential (roundtrip)
- Rejects expired grant
- Rejects expired credential
- Rejects grant verified with wrong public key
- Rejects credential verified with wrong public key
- Rejects a space_credential JWT when verified as member_grant (typ mismatch)
- Verifies lxm binding on grant equals `com.atproto.space.getSpaceCredential`

- [ ] **Step 2:** Run tests.

Run: `cd packages/space && pnpm test`

- [ ] **Step 3:** Commit.

```bash
git add packages/space/tests/space.test.ts
git commit -m "test: add credential and member grant verification tests"
```

---

## Phase 3: DB Migration and Schema

### Task 9: Create new schema type files

**Files:**
- Modify: `packages/pds/src/actor-store/db/schema/space.ts`
- Modify: `packages/pds/src/actor-store/db/schema/space-member.ts`
- Create: `packages/pds/src/actor-store/db/schema/space-repo.ts`
- Create: `packages/pds/src/actor-store/db/schema/space-member-state.ts`
- Create: `packages/pds/src/actor-store/db/schema/space-record-oplog.ts`
- Create: `packages/pds/src/actor-store/db/schema/space-member-oplog.ts`
- Create: `packages/pds/src/actor-store/db/schema/space-credential-recipient.ts`
- Modify: `packages/pds/src/actor-store/db/schema/index.ts`

- [ ] **Step 1:** Update `space.ts` — remove `setHash` and `rev`, add `isMember`:

```ts
export interface Space {
  uri: string
  isOwner: number
  isMember: number
  createdAt: string
}
```

- [ ] **Step 2:** Update `space-member.ts` — add `memberRev`:

```ts
export interface SpaceMember {
  space: string
  did: string
  memberRev: string
  addedAt: string
}
```

- [ ] **Step 3:** Create the five new schema files (`space-repo.ts`, `space-member-state.ts`, `space-record-oplog.ts`, `space-member-oplog.ts`, `space-credential-recipient.ts`) following the existing pattern (interface + tableName + PartialDB type).

- [ ] **Step 4:** Update `schema/index.ts` — import all new schema modules and add to `DatabaseSchema` type.

- [ ] **Step 5:** Commit.

```bash
git add packages/pds/src/actor-store/db/schema/
git commit -m "feat: add schema types for space tables"
```

### Task 10: Create migration 003-space-update

**Files:**
- Create: `packages/pds/src/actor-store/db/migrations/003-space-update.ts`
- Modify: `packages/pds/src/actor-store/db/migrations/index.ts`

- [ ] **Step 1:** Create migration file with `up()`:
- Alter `space`: drop `setHash`, drop `rev`, add `isMember` (integer, notNull, default 0)
- Alter `space_member`: add `memberRev` (varchar, notNull, default '')
- Create `space_member_state` (space PK, setHash blob nullable, rev varchar nullable)
- Create `space_repo` (space PK, setHash blob nullable, rev varchar nullable)
- Create `space_record_oplog` (space, rev, idx, action, collection, rkey, cid nullable, prev nullable — PK on space/rev/idx)
- Create `space_member_oplog` (space, rev, idx, action, did — PK on space/rev/idx)
- Create `space_credential_recipient` (space, serviceDid, serviceEndpoint, lastIssuedAt — PK on space/serviceDid)

And `down()` to reverse.

- [ ] **Step 2:** Register in `migrations/index.ts`.

- [ ] **Step 3:** Build.

Run: `cd packages/pds && pnpm build`

- [ ] **Step 4:** Commit.

```bash
git add packages/pds/src/actor-store/db/migrations/
git commit -m "feat: add migration 003 for space table restructuring"
```

---

## Phase 4: PDS Actor Store Updates

### Task 11: Update SpaceReader

**Files:**
- Modify: `packages/pds/src/actor-store/space/reader.ts`

- [ ] **Step 1:** Update `getSpace()` — return `{ uri, isOwner, isMember }` (no setHash/rev).

- [ ] **Step 2:** Update `getSetHash()` and `getRev()` — read from `space_repo` table instead of `space`.

- [ ] **Step 3:** Add `getRepoState(space)` → `{ setHash: Buffer | null, rev: string | null }` reading from `space_repo`.

- [ ] **Step 4:** Add `getMemberState(space)` → `{ setHash: Buffer | null, rev: string | null }` reading from `space_member_state`.

- [ ] **Step 5:** Add `getRepoOplog(space, opts: { since?: string, limit?: number })` — query `space_record_oplog` where `rev > since` (if provided), order by `(rev, idx)`, limit. Return `{ ops, ...repoState }` by joining with `getRepoState`.

- [ ] **Step 6:** Add `getMemberOplog(space, opts: { since?: string, limit?: number })` — same pattern against `space_member_oplog` + `space_member_state`.

- [ ] **Step 7:** Add `getCredentialRecipients(space)` — query `space_credential_recipient`.

- [ ] **Step 8:** Update `listMembers()` to include `memberRev` in the returned data.

- [ ] **Step 9:** Build.

Run: `cd packages/pds && pnpm build`

- [ ] **Step 10:** Commit.

```bash
git add packages/pds/src/actor-store/space/reader.ts
git commit -m "feat: update SpaceReader for new table structure and oplog queries"
```

### Task 12: Update SpaceTransactor

**Files:**
- Modify: `packages/pds/src/actor-store/space/transactor.ts`

- [ ] **Step 1:** Update `createSpace()` — no longer insert setHash/rev into `space`. Add `isMember` column. If `isOwner`, also create a row in `space_member_state`. Always create a row in `space_repo`.

- [ ] **Step 2:** Rename `applyCommit()` to `applyRepoCommit()`. Update to:
- Write records to `space_record` (same upsert/delete logic)
- Update `space_repo` (not `space`) for setHash/rev
- For each write op, look up the existing record's CID (for the `prev` field), then append to `space_record_oplog` with `(space, rev, idx, action, collection, rkey, cid, prev)`

- [ ] **Step 3:** Add `applyMemberCommit(space, commit: MemberCommitData)`:
- For each op: add inserts to `space_member` with `memberRev`, remove deletes from `space_member`
- Update `space_member_state` (setHash, rev)
- Append to `space_member_oplog`

- [ ] **Step 4:** Add `updateMembership(space, isMember: boolean)` — update `isMember` flag on `space` table.

- [ ] **Step 5:** Add `recordCredentialRecipient(space, serviceDid, serviceEndpoint)` — upsert into `space_credential_recipient`.

- [ ] **Step 6:** Update `deleteSpace()` to clean up all related tables.

- [ ] **Step 7:** Build.

Run: `cd packages/pds && pnpm build`

- [ ] **Step 8:** Commit.

```bash
git add packages/pds/src/actor-store/space/transactor.ts
git commit -m "feat: update SpaceTransactor with oplog, member commit, and credential recipient support"
```

### Task 13: Create SQL storage adapters

**Files:**
- Create: `packages/pds/src/actor-store/space/sql-repo-storage.ts`
- Create: `packages/pds/src/actor-store/space/sql-members-storage.ts`
- Modify: `packages/pds/src/actor-store/space/index.ts`
- Delete: `packages/pds/src/actor-store/space/scoped-storage.ts` (replaced by sql-repo-storage)

- [ ] **Step 1:** Create `sql-repo-storage.ts` implementing `SpaceRepoStorage` from `@atproto/space`. Wraps SpaceTransactor, scoped to a single space. Methods delegate to transactor reader/writer methods (same pattern as the old `ScopedSpaceStorage` but reads setHash from `space_repo` via `getRepoState`).

- [ ] **Step 2:** Create `sql-members-storage.ts` implementing `SpaceMembersStorage` from `@atproto/space`. Wraps SpaceTransactor, scoped to a single space.

- [ ] **Step 3:** Update `packages/pds/src/actor-store/space/index.ts` — export new files, remove `scoped-storage` export.

- [ ] **Step 4:** Delete `packages/pds/src/actor-store/space/scoped-storage.ts`.

- [ ] **Step 5:** Build.

Run: `cd packages/pds && pnpm build`

- [ ] **Step 6:** Commit.

```bash
git add packages/pds/src/actor-store/space/
git commit -m "feat: add SqlRepoStorage and SqlMembersStorage, remove ScopedSpaceStorage"
```

---

## Phase 5: Lexicons and Codegen

### Task 14: Create new lexicon JSON files

**Files:**
- Create: `lexicons/com/atproto/space/getMembers.json`
- Create: `lexicons/com/atproto/space/getMemberGrant.json`
- Create: `lexicons/com/atproto/space/getSpaceCredential.json`
- Create: `lexicons/com/atproto/space/getRepoState.json`
- Create: `lexicons/com/atproto/space/getRepoOplog.json`
- Create: `lexicons/com/atproto/space/getMemberState.json`
- Create: `lexicons/com/atproto/space/getMemberOplog.json`
- Create: `lexicons/com/atproto/space/notifyWrite.json`

- [ ] **Step 1:** Create all 8 lexicon files. Key shapes:

**getMembers** — query, params: `{ space }`, output: `{ members: [{ did, addedAt }] }`

**getMemberGrant** — query, params: `{ space }`, output: `{ grant: string }`

**getSpaceCredential** — procedure, input: `{ space, grant, serviceEndpoint? }`, output: `{ credential: string }`, errors: SpaceNotFound, NotAMember, InvalidGrant

**getRepoState** — query, params: `{ space, did }`, output: `{ setHash?, rev? }`

**getRepoOplog** — query, params: `{ space, did, since?, limit? }`, output: `{ ops: [{ rev, idx, action, collection, rkey, cid?, prev? }], setHash?, rev?, cursor? }`

**getMemberState** — query, params: `{ space }`, output: `{ setHash?, rev? }`

**getMemberOplog** — query, params: `{ space, since?, limit? }`, output: `{ ops: [{ rev, idx, action, did }], setHash?, rev?, cursor? }`

**notifyWrite** — procedure, input: `{ space, did, rev }`

Refer to existing lexicons in `lexicons/com/atproto/space/` for format conventions.

- [ ] **Step 2:** Commit lexicons.

```bash
git add lexicons/com/atproto/space/
git commit -m "feat: add lexicons for space credentials, sync, and notifications"
```

### Task 15: Run codegen

- [ ] **Step 1:** Run codegen from repo root.

Run: `cd /Users/dholms/projects/bluesky/atproto && pnpm codegen`

- [ ] **Step 2:** Verify generated files appear under `packages/pds/src/lexicons/` for the new endpoints.

- [ ] **Step 3:** Commit generated code.

```bash
git add -A
git commit -m "chore: run codegen for new space lexicons"
```

---

## Phase 6: PDS Endpoint Implementation

### Task 16: Update existing CRUD endpoints for renames

**Files:**
- Modify: `packages/pds/src/api/com/atproto/space/createRecord.ts`
- Modify: `packages/pds/src/api/com/atproto/space/putRecord.ts`
- Modify: `packages/pds/src/api/com/atproto/space/deleteRecord.ts`
- Modify: `packages/pds/src/api/com/atproto/space/applyWrites.ts`

- [ ] **Step 1:** In all four files:
- Replace `import { Repo, ... } from '@atproto/space'` with `import { SpaceRepo, ... } from '@atproto/space'`
- Replace `ScopedSpaceStorage` with `SqlRepoStorage` (import from `../../../../actor-store/space`)
- Replace `Repo.loadOrCreate` with `SpaceRepo.loadOrCreate`
- Replace `actorTxn.space.applyCommit(...)` with `actorTxn.space.applyRepoCommit(...)`
- Replace `actorTxn.space.getRev(...)` with calls to `actorTxn.space.getRepoState(...)` for swap commit checks

- [ ] **Step 2:** After each write endpoint, add fire-and-forget `notifyWrite` call to space owner's PDS (skip for now if space owner is local — add @TODO comment). Pattern: resolve space owner DID from space URI, resolve DID doc for service endpoint, call `com.atproto.space.notifyWrite` with service auth.

- [ ] **Step 3:** Build.

Run: `cd packages/pds && pnpm build`

- [ ] **Step 4:** Commit.

```bash
git add packages/pds/src/api/com/atproto/space/
git commit -m "refactor: update CRUD endpoints for SpaceRepo rename and SqlRepoStorage"
```

### Task 17: Update addMember/removeMember to use SpaceMembers

**Files:**
- Modify: `packages/pds/src/api/com/atproto/space/addMember.ts`
- Modify: `packages/pds/src/api/com/atproto/space/removeMember.ts`

- [ ] **Step 1:** Update `addMember.ts` — inside the transaction, load `SpaceMembers` via `SqlMembersStorage`, call `members.formatCommit({ action: MemberOpAction.Add, did })`, then `actorTxn.space.applyMemberCommit(space, commit)`. Keep the existing `notifyMembership` call to the member's PDS.

- [ ] **Step 2:** Update `removeMember.ts` — same pattern with `MemberOpAction.Remove`. The `notifyMembership` call sends `isMember: false`.

- [ ] **Step 3:** Build.

Run: `cd packages/pds && pnpm build`

- [ ] **Step 4:** Commit.

```bash
git add packages/pds/src/api/com/atproto/space/addMember.ts packages/pds/src/api/com/atproto/space/removeMember.ts
git commit -m "feat: use SpaceMembers for member list operations with committed set hash"
```

### Task 18: Update notifyMembership and createSpace

**Files:**
- Modify: `packages/pds/src/api/com/atproto/space/notifyMembership.ts`
- Modify: `packages/pds/src/api/com/atproto/space/createSpace.ts`

- [ ] **Step 1:** Update `notifyMembership.ts` — when `isMember: true`, create/update space entry with `isMember = true` (use `updateMembership`). When `isMember: false`, set `isMember = false` but do NOT delete the space entry or records.

- [ ] **Step 2:** Update `createSpace.ts` — adapt for the new table structure (createSpace now creates rows in `space`, `space_repo`, and if owner, `space_member_state`).

- [ ] **Step 3:** Build.

Run: `cd packages/pds && pnpm build`

- [ ] **Step 4:** Commit.

```bash
git add packages/pds/src/api/com/atproto/space/notifyMembership.ts packages/pds/src/api/com/atproto/space/createSpace.ts
git commit -m "feat: update notifyMembership for isMember flag, update createSpace for new tables"
```

### Task 19: Add space credential auth verifier

**Files:**
- Modify: `packages/pds/src/auth-verifier.ts`
- Modify: `packages/pds/src/auth-output.ts`

- [ ] **Step 1:** In `auth-output.ts`, add:

```ts
export type SpaceCredentialOutput = {
  credentials: {
    type: 'space_credential'
    iss: string
    space: string
    clientId: string
  }
}
```

- [ ] **Step 2:** In `auth-verifier.ts`, add a `spaceCredentialAuth` method that:
1. Extracts bearer token from Authorization header
2. Uses `verifySpaceCredential` from `@atproto/space` (need to resolve space owner's DID doc to get public key)
3. Returns `SpaceCredentialOutput` with `iss`, `space`, `clientId`

Pattern follows existing `serviceAuth` method. The key difference: uses `verifySpaceCredential` which checks `typ === "space_credential"`.

- [ ] **Step 3:** Build.

Run: `cd packages/pds && pnpm build`

- [ ] **Step 4:** Commit.

```bash
git add packages/pds/src/auth-verifier.ts packages/pds/src/auth-output.ts
git commit -m "feat: add space credential auth verifier path"
```

### Task 20: Add credential flow endpoints

**Files:**
- Create: `packages/pds/src/api/com/atproto/space/getMemberGrant.ts`
- Create: `packages/pds/src/api/com/atproto/space/getSpaceCredential.ts`

- [ ] **Step 1:** Create `getMemberGrant.ts`:
- Auth: standard OAuth (member is authenticated)
- Verify the space exists in member's actor store
- Parse space URI to extract owner DID
- Get member's keypair via `ctx.actorStore.keypair(memberDid)`
- Extract clientId from OAuth credentials (may need to access the OAuth token — @TODO: verify how to get clientId from OAuthOutput. If not available, use a placeholder and note as spec question)
- Call `createMemberGrant({ iss: memberDid, aud: ownerDid, space, clientId }, keypair)`
- Return `{ grant }`

- [ ] **Step 2:** Create `getSpaceCredential.ts`:
- Auth: none (the grant JWT is the authentication)
- Parse the grant JWT to extract member DID (iss)
- Resolve member's DID doc, extract signing key
- Call `verifyMemberGrant(grant, memberDidKey)`
- Verify grant.aud matches the space owner DID
- Verify grant.space matches the requested space
- Check membership via actor store
- Get space owner's keypair, call `createSpaceCredential({ iss: ownerDid, space, clientId: grant.clientId }, keypair)`
- If serviceEndpoint provided, call `recordCredentialRecipient`
- Return `{ credential }`

- [ ] **Step 3:** Build.

Run: `cd packages/pds && pnpm build`

- [ ] **Step 4:** Commit.

```bash
git add packages/pds/src/api/com/atproto/space/getMemberGrant.ts packages/pds/src/api/com/atproto/space/getSpaceCredential.ts
git commit -m "feat: add getMemberGrant and getSpaceCredential endpoints"
```

### Task 21: Add sync endpoints

**Files:**
- Create: `packages/pds/src/api/com/atproto/space/getRepoState.ts`
- Create: `packages/pds/src/api/com/atproto/space/getRepoOplog.ts`
- Create: `packages/pds/src/api/com/atproto/space/getMemberState.ts`
- Create: `packages/pds/src/api/com/atproto/space/getMemberOplog.ts`
- Create: `packages/pds/src/api/com/atproto/space/getMembers.ts`

- [ ] **Step 1:** Create all four sync endpoints. All use `spaceCredentialAuth`. Pattern:
- Verify `auth.credentials.space` matches the requested space
- Call the corresponding reader method on the actor store
- Return the data

**getRepoState**: reads from `store.space.getRepoState(space)`, returns `{ setHash: hex, rev }`.

**getRepoOplog**: reads from `store.space.getRepoOplog(space, { since, limit })`, returns `{ ops, setHash, rev }`.

**getMemberState**: reads from `store.space.getMemberState(space)` on owner's actor store, returns `{ setHash, rev }`.

**getMemberOplog**: reads from `store.space.getMemberOplog(space, { since, limit })`, returns `{ ops, setHash, rev }`.

- [ ] **Step 2:** Create `getMembers.ts` — auth: standard OAuth, verify owner, return member list.

- [ ] **Step 3:** Build.

Run: `cd packages/pds && pnpm build`

- [ ] **Step 4:** Commit.

```bash
git add packages/pds/src/api/com/atproto/space/getRepoState.ts packages/pds/src/api/com/atproto/space/getRepoOplog.ts packages/pds/src/api/com/atproto/space/getMemberState.ts packages/pds/src/api/com/atproto/space/getMemberOplog.ts packages/pds/src/api/com/atproto/space/getMembers.ts
git commit -m "feat: add sync endpoints and getMembers"
```

### Task 22: Add notifyWrite endpoint

**Files:**
- Create: `packages/pds/src/api/com/atproto/space/notifyWrite.ts`

- [ ] **Step 1:** Create `notifyWrite.ts`:
- Auth: service auth
- Extract space, memberDid, rev from input
- Parse space URI for owner DID
- Look up credential recipients for this space
- Fan out `notifyWrite` calls to each recipient (fire-and-forget with error swallowing)

- [ ] **Step 2:** Build.

Run: `cd packages/pds && pnpm build`

- [ ] **Step 3:** Commit.

```bash
git add packages/pds/src/api/com/atproto/space/notifyWrite.ts
git commit -m "feat: add notifyWrite endpoint with fan-out to credential recipients"
```

### Task 23: Register all new endpoints

**Files:**
- Modify: `packages/pds/src/api/com/atproto/space/index.ts`

- [ ] **Step 1:** Add imports and registrations for: getMembers, getMemberGrant, getSpaceCredential, getRepoState, getRepoOplog, getMemberState, getMemberOplog, notifyWrite.

- [ ] **Step 2:** Build full PDS.

Run: `cd packages/pds && pnpm build`

- [ ] **Step 3:** Commit.

```bash
git add packages/pds/src/api/com/atproto/space/index.ts
git commit -m "feat: register all new space endpoints"
```

---

## Phase 7: Tests

### Task 24: Fix existing PDS space tests

**Files:**
- Modify: `packages/pds/tests/spaces.test.ts`

- [ ] **Step 1:** Update tests for:
- SpaceRepo rename (if test imports from `@atproto/space`)
- `removeMember` behavior change: space persists with `isMember: false` instead of being deleted
- Any table/schema changes that affect test assertions

- [ ] **Step 2:** Run tests.

Run: `cd packages/pds && pnpm test -- --testPathPattern spaces`

- [ ] **Step 3:** Commit.

```bash
git add packages/pds/tests/spaces.test.ts
git commit -m "test: fix existing space tests for new table structure"
```

### Task 25: Add oplog and member state tests

**Files:**
- Modify: `packages/pds/tests/spaces.test.ts`

- [ ] **Step 1:** Add tests:
- After creating records, verify oplog entries exist (query via actor store directly or through getRepoOplog if credential flow is tested separately)
- After adding/removing members, verify member oplog entries
- Verify setHash on space_repo updates after writes
- Verify setHash on space_member_state updates after member changes
- Verify batch applyWrites produces multiple oplog entries with same rev but different idx

- [ ] **Step 2:** Run tests.

Run: `cd packages/pds && pnpm test -- --testPathPattern spaces`

- [ ] **Step 3:** Commit.

```bash
git add packages/pds/tests/spaces.test.ts
git commit -m "test: add oplog and member state verification tests"
```

### Task 26: Add credential flow integration tests

**Files:**
- Modify: `packages/pds/tests/spaces.test.ts`

- [ ] **Step 1:** Add `describe('credential flow', ...)`:
- Member obtains grant from PDS, exchanges for credential on owner's PDS
- Non-member's grant is rejected at credential exchange
- Credential can be used to call getRepoState
- Credential can be used to call getRepoOplog
- Expired credential is rejected (may need time manipulation or short expiry in test)

Note: In a single-PDS test environment, both owner and member are on the same PDS. This still exercises the full endpoint flow.

- [ ] **Step 2:** Run tests.

Run: `cd packages/pds && pnpm test -- --testPathPattern spaces`

- [ ] **Step 3:** Commit.

```bash
git add packages/pds/tests/spaces.test.ts
git commit -m "test: add credential flow integration tests"
```

### Task 27: Add sync flow integration tests

**Files:**
- Modify: `packages/pds/tests/spaces.test.ts`

- [ ] **Step 1:** Add `describe('sync', ...)`:
- Full sync: create records → get credential → getRepoOplog returns ops → getRecord with credential returns record content
- Incremental sync: create more records → getRepoOplog with `since` returns only new ops
- Member list sync: add members → getMemberOplog returns add ops

- [ ] **Step 2:** Run tests.

Run: `cd packages/pds && pnpm test -- --testPathPattern spaces`

- [ ] **Step 3:** Commit.

```bash
git add packages/pds/tests/spaces.test.ts
git commit -m "test: add sync flow integration tests"
```

### Task 28: Add notification flow test

**Files:**
- Modify: `packages/pds/tests/spaces.test.ts`

- [ ] **Step 1:** Add test for notifyWrite:
- Create a record on member's account
- Verify notifyWrite is called on space owner's PDS (may need to mock or intercept HTTP calls)
- This test may be simpler as a unit test of the endpoint handler with mocked dependencies

@TODO: Multi-PDS notification tests will need dev-env work. For now, test the single-PDS path where owner is local.

- [ ] **Step 2:** Run tests.

Run: `cd packages/pds && pnpm test -- --testPathPattern spaces`

- [ ] **Step 3:** Commit.

```bash
git add packages/pds/tests/spaces.test.ts
git commit -m "test: add notification flow tests"
```

---

## Verification

After all phases complete:

```bash
# Build everything
cd /Users/dholms/projects/bluesky/atproto
pnpm build

# Run space package tests
cd packages/space && pnpm test

# Run PDS tests
cd packages/pds && pnpm test -- --testPathPattern spaces

# Run full PDS test suite to check for regressions
cd packages/pds && pnpm test
```

---

## Open Questions for Implementation

- **clientId from OAuth**: `OAuthOutput` doesn't expose `clientId`. Need to investigate how to extract it from the auth context for `getMemberGrant`. May need to extend the auth verifier or access the token directly.
- **Space URI parsing**: Need a utility to parse `ats://did:plc:abc/type/key` into components. May create a `SpaceUri` class in `@atproto/space` or `@atproto/syntax`.
- **SQLite DROP COLUMN**: Migration uses `dropColumn` which requires SQLite 3.35+. Verify CI environment compatibility.
- **Multi-PDS tests**: Single-PDS tests cover the endpoint flow but not cross-PDS networking. Dev-env may need multiple PDS instances for full protocol tests.
- **DID resolution in credential flow**: `getSpaceCredential` needs to resolve the member's DID doc to verify the grant signature. Uses `ctx.idResolver.did.resolve()` from the existing PDS context.
