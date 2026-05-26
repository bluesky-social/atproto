# LtHash Set Commitment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder XOR-of-SHA256 set hash in `@atproto/space` with an LtHash-based commitment whose protocol-visible value is `sha256(LtHash state)`, while preserving the 32-byte shape of `SignedCommit.hash`.

**Architecture:** Add a standalone `LtHash` primitive (`n=1024`, `q=2^16`, BLAKE3 XOF expansion, lane-wise mod-2^16 add/subtract) inside the space package. Rework `SetHash` to compose `LtHash`, exposing the 2048-byte lattice state via `toBytes()` for storage and a 32-byte `digest()` (= sha256 of state) for the protocol. Update `commit.ts`, both `SpaceRepo`/`SpaceMembers`, the storage interface (`getSetHash` → `getSetHashState`), and the PDS sql/handler layers to plumb the new state size through, while leaving the wire format unchanged.

**Tech Stack:** TypeScript, vitest, `@noble/hashes` (already in workspace; will be added as direct dep of `@atproto/space`).

**Spec:** `docs/superpowers/specs/2026-05-21-lthash-set-hash-design.md`

---

## File map

**Create**
- `packages/space/src/lthash.ts` — new primitive
- `packages/space/tests/lthash.test.ts` — primitive tests

**Modify**
- `packages/space/package.json` — add `@noble/hashes` dep
- `packages/space/src/set-hash.ts` — rebuild around `LtHash`, add `digest()`
- `packages/space/src/index.ts` — export `LtHash`
- `packages/space/src/commit.ts` — HMAC/sign over `setHash.digest()`
- `packages/space/src/space-repo.ts` — use `digest()` in equality, update load paths
- `packages/space/src/space-members.ts` — same
- `packages/space/src/storage/types.ts` — rename `getSetHash` → `getSetHashState`
- `packages/space/src/storage/memory-repo-storage.ts` — rename method
- `packages/space/src/storage/memory-members-storage.ts` — rename method
- `packages/space/tests/space.test.ts` — update SetHash tests for 2048-byte state, add cross-check assertions
- `packages/space/BIG_PICTURE.md` — replace ECMH wording with LtHash + sha256-of-state
- `packages/pds/src/actor-store/space/sql-repo-storage.ts` — rename method
- `packages/pds/src/actor-store/space/sql-members-storage.ts` — rename method
- `packages/pds/src/api/com/atproto/space/getRepoState.ts` — emit digest, not raw state
- `packages/pds/src/api/com/atproto/space/getMemberState.ts` — same
- `packages/pds/src/api/com/atproto/space/getRepoOplog.ts` — same
- `packages/pds/src/api/com/atproto/space/getMemberOplog.ts` — same
- `packages/pds/src/actor-store/space/reader.ts` — `getRepoOplog`/`getMemberOplog` should expose digest separately, OR handlers compute it; we'll do the latter to keep reader returning state bytes

---

## Task 1: Add `@noble/hashes` to `@atproto/space`

**Files:**
- Modify: `packages/space/package.json`

- [ ] **Step 1: Add the dep**

Edit `packages/space/package.json` `dependencies` block to include `"@noble/hashes": "^1.6.1"` (matching `packages/crypto/package.json`):

```json
  "dependencies": {
    "@atproto/crypto": "workspace:^",
    "@atproto/lex-cbor": "workspace:^",
    "@atproto/lex-data": "workspace:^",
    "@noble/hashes": "^1.6.1"
  },
```

- [ ] **Step 2: Install**

Run from repo root: `pnpm install`
Expected: lockfile updates, no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/space/package.json pnpm-lock.yaml
git commit -m "space: add @noble/hashes dep for LtHash"
```

---

## Task 2: Implement `LtHash` primitive (failing tests first)

**Files:**
- Create: `packages/space/tests/lthash.test.ts`
- Create: `packages/space/src/lthash.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/space/tests/lthash.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { LtHash } from '../src/lthash.js'

const STATE_BYTES = 2048

describe('LtHash', () => {
  it('starts as 2048 zero bytes', () => {
    const h = new LtHash()
    expect(h.toBytes()).toEqual(new Uint8Array(STATE_BYTES))
  })

  it('add then remove returns to zero state', () => {
    const h = new LtHash()
    h.add('element')
    expect(h.toBytes()).not.toEqual(new Uint8Array(STATE_BYTES))
    h.remove('element')
    expect(h.toBytes()).toEqual(new Uint8Array(STATE_BYTES))
  })

  it('is order-independent across many adds', () => {
    const a = new LtHash()
    const b = new LtHash()
    const items = ['alpha', 'beta', 'gamma', 'delta', 'epsilon']
    for (const x of items) a.add(x)
    for (const x of [...items].reverse()) b.add(x)
    expect(a.equals(b)).toBe(true)
  })

  it('round-trips via toBytes/constructor', () => {
    const a = new LtHash()
    a.add('one')
    a.add('two')
    const b = new LtHash(a.toBytes())
    expect(a.equals(b)).toBe(true)
  })

  it('rejects construction from wrong-length bytes', () => {
    expect(() => new LtHash(new Uint8Array(32))).toThrow()
  })

  it('does not share state with constructor argument', () => {
    const init = new Uint8Array(STATE_BYTES)
    init[0] = 0xff
    const h = new LtHash(init)
    init[0] = 0x00
    expect(h.toBytes()[0]).toBe(0xff)
  })

  it('accepts Uint8Array elements', () => {
    const a = new LtHash()
    const b = new LtHash()
    a.add('hello')
    b.add(new TextEncoder().encode('hello'))
    expect(a.equals(b)).toBe(true)
  })

  it('double-add of same element does NOT zero out (multiset)', () => {
    const h = new LtHash()
    h.add('x')
    h.add('x')
    expect(h.toBytes()).not.toEqual(new Uint8Array(STATE_BYTES))
  })

  it('snapshot vector locks the algorithm', () => {
    // Algorithm: n=1024 lanes of u16, q=2^16, BLAKE3 XOF dkLen=2048,
    // lane-wise modular add. If this snapshot ever changes, the
    // on-disk state format has changed and storage migration is
    // required.
    const h = new LtHash()
    h.add('atproto')
    h.add('space')
    const hex = Buffer.from(h.toBytes()).toString('hex')
    // Replace this placeholder once Step 3 implementation is in place
    // and you've verified the value: copy the actual hex from a one-
    // off `console.log(hex)` after the implementation passes the
    // other tests, then commit it as the snapshot.
    expect(hex.length).toBe(STATE_BYTES * 2)
    expect(hex).toBe('__SNAPSHOT_HEX__')
  })
})
```

Note: the snapshot test will fail until Step 4 fills in `__SNAPSHOT_HEX__`. Leave it failing through Steps 2-3.

- [ ] **Step 2: Run failing tests**

Run: `pnpm --filter @atproto/space test lthash`
Expected: all tests fail with "Cannot find module '../src/lthash.js'".

- [ ] **Step 3: Implement `LtHash`**

Create `packages/space/src/lthash.ts`:

```ts
import { blake3 } from '@noble/hashes/blake3'

const LANES = 1024
const LANE_BYTES = 2
const STATE_BYTES = LANES * LANE_BYTES // 2048

export class LtHash {
  private state: Uint16Array

  constructor(init?: Uint8Array) {
    if (init === undefined) {
      this.state = new Uint16Array(LANES)
      return
    }
    if (init.length !== STATE_BYTES) {
      throw new Error(
        `LtHash state must be ${STATE_BYTES} bytes, got ${init.length}`,
      )
    }
    const lanes = new Uint16Array(LANES)
    for (let i = 0; i < LANES; i++) {
      lanes[i] = init[i * 2] | (init[i * 2 + 1] << 8)
    }
    this.state = lanes
  }

  add(element: Uint8Array | string): void {
    this.combine(element, 1)
  }

  remove(element: Uint8Array | string): void {
    this.combine(element, -1)
  }

  toBytes(): Uint8Array {
    const out = new Uint8Array(STATE_BYTES)
    for (let i = 0; i < LANES; i++) {
      const v = this.state[i]
      out[i * 2] = v & 0xff
      out[i * 2 + 1] = (v >>> 8) & 0xff
    }
    return out
  }

  equals(other: LtHash): boolean {
    const a = this.state
    const b = other.state
    if (a.length !== b.length) return false
    let diff = 0
    for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
    return diff === 0
  }

  private combine(element: Uint8Array | string, sign: 1 | -1): void {
    const input =
      typeof element === 'string' ? new TextEncoder().encode(element) : element
    const expanded = blake3(input, { dkLen: STATE_BYTES })
    if (sign === 1) {
      for (let i = 0; i < LANES; i++) {
        const lane = expanded[i * 2] | (expanded[i * 2 + 1] << 8)
        this.state[i] = (this.state[i] + lane) & 0xffff
      }
    } else {
      for (let i = 0; i < LANES; i++) {
        const lane = expanded[i * 2] | (expanded[i * 2 + 1] << 8)
        this.state[i] = (this.state[i] - lane) & 0xffff
      }
    }
  }
}
```

- [ ] **Step 4: Run tests, capture snapshot, fill it in**

Run: `pnpm --filter @atproto/space test lthash`
Expected: all tests pass except the snapshot test, which will fail with `expected 'XXXX...' to be '__SNAPSHOT_HEX__'`.

Copy the actual hex from the failure message into the test's `__SNAPSHOT_HEX__` literal. Re-run.

Run: `pnpm --filter @atproto/space test lthash`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/space/src/lthash.ts packages/space/tests/lthash.test.ts
git commit -m "space: add LtHash primitive (n=1024, q=2^16, BLAKE3 XOF)"
```

---

## Task 3: Rework `SetHash` around `LtHash`

**Files:**
- Modify: `packages/space/src/set-hash.ts`
- Modify: `packages/space/src/index.ts`

- [ ] **Step 1: Update existing SetHash tests in `tests/space.test.ts` to reflect new shape**

Existing tests in `packages/space/tests/space.test.ts` (the `describe('SetHash', ...)` block, around lines 212-256) assume 32-byte state and a `toHex()` method. Update that block to:

```ts
describe('SetHash', () => {
  it('starts empty as 2048 zeroed bytes', () => {
    const h = new SetHash()
    expect(h.toBytes()).toEqual(Buffer.alloc(2048))
  })

  it('digest() of empty SetHash is sha256 of zeros_2048', async () => {
    const h = new SetHash()
    expect(h.digest()).toHaveLength(32)
    // Snapshot the empty digest. Compute expected:
    //   sha256(Buffer.alloc(2048))
    // Replace with actual value after first run.
    expect(h.digest().toString('hex')).toBe('__EMPTY_DIGEST_HEX__')
  })

  it('constructs from bytes', () => {
    const bytes = Buffer.alloc(2048, 0xab)
    const h = new SetHash(bytes)
    expect(h.toBytes()).toEqual(bytes)
  })

  it('is order-independent', async () => {
    const h1 = new SetHash()
    await h1.add('alpha')
    await h1.add('beta')

    const h2 = new SetHash()
    await h2.add('beta')
    await h2.add('alpha')

    expect(h1.equals(h2)).toBe(true)
    expect(h1.digest()).toEqual(h2.digest())
  })

  it('remove reverses add', async () => {
    const h = new SetHash()
    await h.add('element')
    await h.remove('element')
    expect(h.equals(new SetHash())).toBe(true)
  })

  it('does not copy internal state on construct from bytes', () => {
    const bytes = Buffer.alloc(2048, 0xab)
    const h = new SetHash(bytes)
    bytes[0] = 0xff
    expect(h.toBytes()[0]).toBe(0xab)
  })

  it('double-add of same element does not zero out', async () => {
    const h = new SetHash()
    await h.add('x')
    await h.add('x')
    expect(h.equals(new SetHash())).toBe(false)
  })
})
```

Note: the `__EMPTY_DIGEST_HEX__` placeholder gets filled in Step 4 just like the LtHash snapshot.

- [ ] **Step 2: Run tests, see them fail**

Run: `pnpm --filter @atproto/space test space.test.ts -t SetHash`
Expected: all SetHash tests fail (current `SetHash` has no `digest()`, returns 32 bytes, etc.).

- [ ] **Step 3: Rewrite `set-hash.ts`**

Replace `packages/space/src/set-hash.ts` with:

```ts
import { sha256 } from '@noble/hashes/sha256'
import { LtHash } from './lthash.js'

export class SetHash {
  private lt: LtHash

  constructor(state?: Uint8Array | Buffer) {
    this.lt = new LtHash(state ? new Uint8Array(state) : undefined)
  }

  async add(element: string): Promise<void> {
    this.lt.add(element)
  }

  async remove(element: string): Promise<void> {
    this.lt.remove(element)
  }

  // Full LtHash state — for storage. 2048 bytes.
  toBytes(): Buffer {
    return Buffer.from(this.lt.toBytes())
  }

  // Protocol commitment digest — sha256 of state. 32 bytes.
  digest(): Buffer {
    return Buffer.from(sha256(this.lt.toBytes()))
  }

  equals(other: SetHash): boolean {
    return this.lt.equals((other as unknown as { lt: LtHash }).lt)
  }
}
```

The `equals` cast is safe because `lt` is private but type-identical across instances. Alternatively, expose a package-private accessor — but the cast is fine for a single-class private field.

- [ ] **Step 4: Run tests, fill in empty digest snapshot, verify**

Run: `pnpm --filter @atproto/space test space.test.ts -t SetHash`
Expected: all pass except the empty-digest snapshot test, which prints the actual hex. Copy that hex into `__EMPTY_DIGEST_HEX__`.

Re-run: `pnpm --filter @atproto/space test space.test.ts -t SetHash`
Expected: all SetHash tests pass.

- [ ] **Step 5: Export `LtHash` from index**

Edit `packages/space/src/index.ts` to add `export * from './lthash.js'` after the existing `set-hash.js` export:

```ts
export * from './set-hash.js'
export * from './lthash.js'
```

- [ ] **Step 6: Commit**

```bash
git add packages/space/src/set-hash.ts packages/space/src/index.ts packages/space/tests/space.test.ts
git commit -m "space: rebuild SetHash around LtHash with sha256(state) digest"
```

---

## Task 4: Update `commit.ts` to HMAC the digest

**Files:**
- Modify: `packages/space/src/commit.ts`
- Modify: `packages/space/tests/space.test.ts` (add one assertion)

- [ ] **Step 1: Add the failing assertion**

In `packages/space/tests/space.test.ts`, inside the `describe('commits', ...)` block, add this test (after the existing 'creates a valid signed commit' test):

```ts
it('commit.hash equals setHash.digest()', async () => {
  await repo.applyWrites({
    action: WriteOpAction.Create,
    collection: 'app.bsky.feed.post',
    rkey: '1',
    record: { text: 'hello' },
  })
  const commit = await repo.commit(testSpace, keypair)
  expect(commit.hash).toEqual(repo.setHash.digest())
  expect(commit.hash).toHaveLength(32)
})
```

- [ ] **Step 2: Run, see it fail**

Run: `pnpm --filter @atproto/space test space.test.ts -t "commit.hash equals"`
Expected: fail. Current `createCommit` returns `setHash.toBytes()` which is now 2048 bytes, so `commit.hash.length` and equality both fail.

- [ ] **Step 3: Update `createCommit`**

In `packages/space/src/commit.ts`, change `createCommit`:

```ts
export const createCommit = async (
  setHash: SetHash,
  space: SpaceContext,
  keypair: Keypair,
): Promise<SignedCommit> => {
  const hash = setHash.digest()
  const ikm = Buffer.from(randomBytes(32))
  const hmac = deriveKeyAndHmac(ikm, hash, space)
  const sig = Buffer.from(await keypair.sign(ikm))
  return { hash, hmac, ikm, sig }
}
```

`verifyCommit` is already over `commit.hash` — no change needed.

- [ ] **Step 4: Run, verify**

Run: `pnpm --filter @atproto/space test space.test.ts -t commit`
Expected: all commit tests pass. (Note: existing tests like 'two repos with same records produce same hash' continue to pass — both digests will match.)

- [ ] **Step 5: Commit**

```bash
git add packages/space/src/commit.ts packages/space/tests/space.test.ts
git commit -m "space: HMAC and sign over sha256(LtHash state) digest"
```

---

## Task 5: Update `SpaceRepo` and `SpaceMembers` equality + storage method calls

**Files:**
- Modify: `packages/space/src/space-repo.ts`
- Modify: `packages/space/src/space-members.ts`

- [ ] **Step 1: Update `SpaceRepo`**

In `packages/space/src/space-repo.ts`:

Replace every `storage.getSetHash()` call with `storage.getSetHashState()` (lines 43 and 54).

Replace the `verifyCommit` method (current lines 179-184):

```ts
verifyCommit(space: SpaceContext, commit: SignedCommit): boolean {
  return (
    commit.hash.equals(this.setHash.digest()) &&
    verifyCommit(space, commit)
  )
}
```

- [ ] **Step 2: Update `SpaceMembers`**

In `packages/space/src/space-members.ts`:

Same renames: `storage.getSetHash()` → `storage.getSetHashState()` (lines 34 and 44).

Replace `verifyCommit` (current lines 136-141):

```ts
verifyCommit(space: SpaceContext, commit: SignedCommit): boolean {
  return (
    commit.hash.equals(this.setHash.digest()) &&
    verifyCommit(space, commit)
  )
}
```

- [ ] **Step 3: Run tests, expect they fail at compile time only because storage interface still has the old method name**

Run: `pnpm --filter @atproto/space test`
Expected: TypeScript errors about `getSetHashState` not existing on storage interfaces. That's fine — Task 6 fixes the storage layer.

- [ ] **Step 4: Skip commit until Task 6 lands**

This task and Task 6 must land together to keep the build green. Don't commit until after Task 6 Step 4.

---

## Task 6: Rename storage interface method (`@atproto/space` side)

**Files:**
- Modify: `packages/space/src/storage/types.ts`
- Modify: `packages/space/src/storage/memory-repo-storage.ts`
- Modify: `packages/space/src/storage/memory-members-storage.ts`

- [ ] **Step 1: Update interface**

In `packages/space/src/storage/types.ts`:

```ts
export interface SpaceRepoStorage {
  getRecord(collection: string, rkey: string): Promise<RepoRecord | null>
  hasRecord(collection: string, rkey: string): Promise<boolean>
  listCollections(): Promise<string[]>
  listRecords(
    collection: string,
  ): Promise<{ rkey: string; record: RepoRecord }[]>

  // Returns 2048 bytes of LtHash state, or null if uninitialized.
  getSetHashState(): Promise<Buffer | null>

  applyCommit(commit: CommitData): Promise<void>
  destroy(): Promise<void>
}

export interface SpaceMembersStorage {
  getMembers(): Promise<string[]>
  isMember(did: string): Promise<boolean>
  getSetHashState(): Promise<Buffer | null>
  applyCommit(commit: MemberCommitData): Promise<void>
  destroy(): Promise<void>
}
```

- [ ] **Step 2: Update memory implementations**

In `packages/space/src/storage/memory-repo-storage.ts`, rename the field and method. Also rename the private field for clarity:

```ts
export class MemoryRepoStorage implements SpaceRepoStorage {
  private data = new Map<string, RepoRecord>()
  private setHashState: Buffer | null = null

  // ... record methods unchanged ...

  async getSetHashState(): Promise<Buffer | null> {
    return this.setHashState
  }

  async applyCommit(commit: CommitData): Promise<void> {
    for (const write of commit.writes) {
      const key = formatDataKey(write.collection, write.rkey)
      if (
        write.action === WriteOpAction.Create ||
        write.action === WriteOpAction.Update
      ) {
        this.data.set(key, write.record)
      } else if (write.action === WriteOpAction.Delete) {
        this.data.delete(key)
      }
    }
    this.setHashState = Buffer.from(commit.setHash)
  }

  async destroy(): Promise<void> {
    this.data.clear()
    this.setHashState = null
  }
}
```

In `packages/space/src/storage/memory-members-storage.ts`, do the same: rename `setHash` field to `setHashState` and `getSetHash` method to `getSetHashState`.

- [ ] **Step 3: Run tests**

Run: `pnpm --filter @atproto/space test`
Expected: all space-package tests pass. Verify by running everything (not just one suite).

- [ ] **Step 4: Commit Tasks 5 and 6 together**

```bash
git add packages/space/src/space-repo.ts \
        packages/space/src/space-members.ts \
        packages/space/src/storage/
git commit -m "space: rename getSetHash -> getSetHashState; verify commit via digest()"
```

---

## Task 7: Update PDS sql storage adapters

**Files:**
- Modify: `packages/pds/src/actor-store/space/sql-repo-storage.ts`
- Modify: `packages/pds/src/actor-store/space/sql-members-storage.ts`

- [ ] **Step 1: Rename methods**

In `packages/pds/src/actor-store/space/sql-repo-storage.ts`, rename `getSetHash` (lines 43-46) to `getSetHashState`. Body unchanged — the underlying DB column name stays `setHash` (storing 2048 bytes now instead of 32 — the column is `blob` and accepts both).

```ts
async getSetHashState(): Promise<Buffer | null> {
  const state = await this.txn.getRepoState(this.space)
  return state?.setHash ?? null
}
```

In `packages/pds/src/actor-store/space/sql-members-storage.ts`, same rename for `getSetHash` (lines 19-22):

```ts
async getSetHashState(): Promise<Buffer | null> {
  const state = await this.txn.getMemberState(this.space)
  return state?.setHash ?? null
}
```

- [ ] **Step 2: Build the PDS package**

Run: `pnpm --filter @atproto/pds build`
Expected: success. The handlers in Task 8 need to compile next.

- [ ] **Step 3: Don't commit yet — handlers also need updating in Task 8**

PDS won't be functionally correct until Task 8 stops emitting raw 2048-byte state as the wire `setHash`. Hold the commit until then.

---

## Task 8: PDS handlers emit digest, not raw state

The `getRepoState`, `getMemberState`, `getRepoOplog`, and `getMemberOplog` lexicons specify `setHash` as a 32-byte hex string (the protocol commitment). With the new storage layer, the raw `state.setHash` from the DB is 2048 bytes; handlers must hash it before serializing.

**Files:**
- Modify: `packages/pds/src/api/com/atproto/space/getRepoState.ts`
- Modify: `packages/pds/src/api/com/atproto/space/getMemberState.ts`
- Modify: `packages/pds/src/api/com/atproto/space/getRepoOplog.ts`
- Modify: `packages/pds/src/api/com/atproto/space/getMemberOplog.ts`

- [ ] **Step 1: Update `getRepoState.ts`**

Replace the body of the response in `packages/pds/src/api/com/atproto/space/getRepoState.ts` (lines 28-34):

```ts
import { SetHash } from '@atproto/space'
// ... existing imports ...

      const stateBytes = state?.setHash ?? null
      const digest = stateBytes
        ? new SetHash(stateBytes).digest().toString('hex')
        : undefined

      return {
        encoding: 'application/json' as const,
        body: {
          setHash: digest,
          rev: state?.rev ?? undefined,
        },
      }
```

- [ ] **Step 2: Update `getMemberState.ts`**

Same shape in `packages/pds/src/api/com/atproto/space/getMemberState.ts` (around line 33). Add the `SetHash` import; replace the response body construction:

```ts
import { SetHash } from '@atproto/space'
// ...
      const stateBytes = state?.setHash ?? null
      const digest = stateBytes
        ? new SetHash(stateBytes).digest().toString('hex')
        : undefined

      return {
        encoding: 'application/json' as const,
        body: {
          setHash: digest,
          rev: state?.rev ?? undefined,
        },
      }
```

- [ ] **Step 3: Update `getRepoOplog.ts`**

In `packages/pds/src/api/com/atproto/space/getRepoOplog.ts` around line 45:

```ts
import { SetHash } from '@atproto/space'
// ...
      const digest = result.setHash
        ? new SetHash(result.setHash).digest().toString('hex')
        : undefined

      return {
        encoding: 'application/json' as const,
        body: {
          ops: result.ops.map((op) => ({
            rev: op.rev,
            idx: op.idx,
            action: op.action as
              | 'create'
              | 'update'
              | 'delete'
              | l.UnknownString,
            collection: op.collection as l.NsidString,
            rkey: op.rkey as l.RecordKeyString,
            cid: op.cid ? (op.cid as l.CidString) : undefined,
            prev: op.prev ? (op.prev as l.CidString) : undefined,
          })),
          setHash: digest,
          rev: result.rev ?? undefined,
        },
      }
```

- [ ] **Step 4: Update `getMemberOplog.ts`**

Same in `packages/pds/src/api/com/atproto/space/getMemberOplog.ts` around line 40:

```ts
import { SetHash } from '@atproto/space'
// ...
      const digest = result.setHash
        ? new SetHash(result.setHash).digest().toString('hex')
        : undefined

      return {
        encoding: 'application/json' as const,
        body: {
          ops: result.ops.map((op) => ({
            rev: op.rev,
            idx: op.idx,
            action: op.action as 'add' | 'remove' | l.UnknownString,
            did: op.did as l.DidString,
          })),
          setHash: digest,
          rev: result.rev ?? undefined,
        },
      }
```

- [ ] **Step 5: Build PDS**

Run: `pnpm --filter @atproto/pds build`
Expected: success.

- [ ] **Step 6: Run PDS space tests**

Run: `pnpm --filter @atproto/pds test -- space`
Expected: all space-related PDS tests still pass. If any test asserts specific bytes for `setHash`, those values now refer to the 32-byte digest of the stored 2048-byte state — the test may need its expected value updated to match. Update by re-running with `--silent=false` and capturing the new hex from the test output, *only* if the new test value still passes the round-trip property (e.g., `setHash` from `getRepoState` matches `setHash` from `commit.hash` returned by a notify endpoint).

- [ ] **Step 7: Commit Tasks 7 + 8 together**

```bash
git add packages/pds/src/actor-store/space/sql-repo-storage.ts \
        packages/pds/src/actor-store/space/sql-members-storage.ts \
        packages/pds/src/api/com/atproto/space/getRepoState.ts \
        packages/pds/src/api/com/atproto/space/getMemberState.ts \
        packages/pds/src/api/com/atproto/space/getRepoOplog.ts \
        packages/pds/src/api/com/atproto/space/getMemberOplog.ts
git commit -m "pds: store 2048-byte LtHash state, expose sha256 digest on the wire"
```

---

## Task 9: Update BIG_PICTURE.md

**Files:**
- Modify: `packages/space/BIG_PICTURE.md`

- [ ] **Step 1: Replace the ECMH paragraph**

In `packages/space/BIG_PICTURE.md`, find the paragraph (around lines 84-86) starting `We use ECMH (Elliptic Curve Multiset Hash)...` and replace through to and including the next paragraph that ends `...lower overhead cryptographic structure and sync protocol.` (around line 86) with:

```markdown
We use LtHash, a lattice-based homomorphic set hash whose collision
resistance reduces to the Short Integer Solution problem (Lewi et al.,
IACR 2019/227, also deployed by Meta). We use the standard parameters
`n=1024` lanes of `q=2^16`, giving ~200-bit collision resistance.
Adding or removing an element is a single XOF expansion plus a
lane-wise modular addition over a 2048-byte state. Two permissioned
repos with the same live records produce the same state regardless
of operation history.

The commitment value exchanged on the wire is `sha256(state)`: a
32-byte digest derived from the 2048-byte lattice state. This keeps
the on-wire commit shape compact while leaving the homomorphic
arithmetic to the full LtHash state held in storage. The size
tradeoff (~2KB persisted state vs. e.g. ECMH's ~32 bytes) buys a
self-contained primitive with no hash-to-curve, no point-validation
footguns, and no new cryptographic dependencies.
```

- [ ] **Step 2: Commit**

```bash
git add packages/space/BIG_PICTURE.md
git commit -m "space: BIG_PICTURE — describe LtHash + sha256(state) commitment"
```

---

## Task 10: Final verification

- [ ] **Step 1: Build all affected packages**

Run from repo root:

```bash
pnpm --filter @atproto/space build
pnpm --filter @atproto/pds build
```

Expected: both succeed.

- [ ] **Step 2: Run all tests in affected packages**

```bash
pnpm --filter @atproto/space test
pnpm --filter @atproto/pds test
```

Expected: all pass. If a PDS test fails because it hardcoded a 64-char-hex `setHash` value, update the expected value to the new digest as described in Task 8 Step 6.

- [ ] **Step 3: Spot check property tests**

Run the order-independence and digest assertions specifically:

```bash
pnpm --filter @atproto/space test -t "order-independent"
pnpm --filter @atproto/space test -t "two repos with same records"
pnpm --filter @atproto/space test -t "delete reverses add"
pnpm --filter @atproto/space test -t "double-add"
```

Expected: all pass. These collectively confirm the homomorphic-set property survived the migration and the new primitive correctly distinguishes duplicates from singles.

- [ ] **Step 4: No commit needed for verification — just confirm green**

If everything is green, the branch is ready for review.
