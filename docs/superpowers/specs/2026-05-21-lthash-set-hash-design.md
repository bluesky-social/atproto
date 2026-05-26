# LtHash-based Set Commitment for Permissioned Repos

**Date:** 2026-05-21
**Status:** Design
**Affected packages:** `@atproto/space`

## Background

Each user's permissioned repo within a space is summarized by a single
cryptographic commitment over the set of currently-live records. The same
construction is used over a space's member list. Today this commitment is
built on an XOR-of-SHA256 set hash (`packages/space/src/set-hash.ts`),
which was chosen as a placeholder.

XOR-of-hashes is unsuitable as a final primitive:

- The construction is vulnerable to Wagner-style birthday attacks: an
  attacker who can choose elements can find collisions in roughly
  `2^(n/(1+log2(k)))` work, far below the nominal `2^128` from SHA-256.

The protocol needs a homomorphic set hash with security tied to a hard
problem and operations that remain `O(1)` per element.

## Decision

Replace the XOR-of-hashes core with **LtHash** (the lattice-based
homomorphic hash of Lewi, Kim, Nikolaenko, Raghuraman — IACR 2019/227,
deployed by Meta and implemented at `lukechampine/lthash`). The
protocol-visible commitment value remains a 32-byte SHA-256 digest of the
LtHash state.

Concretely:

- **Internal state:** an LtHash with `n = 1024` lanes of `q = 2^16`,
  i.e. 2048 bytes, held in a `Uint16Array(1024)`.
- **Element ingestion:** each element is expanded by BLAKE3 in XOF mode
  (`dkLen = 2048`) into 2048 bytes, read as 1024 little-endian `u16`
  lanes, and lane-wise added (or subtracted) into the state mod 2^16.
- **Wire/protocol commitment:** `digest = sha256(state_bytes)`, exactly
  32 bytes. This is what is HMAC'd, signed, and exchanged between
  peers.

This preserves the existing `SignedCommit` shape (`hash` is still 32
bytes) while replacing the underlying primitive with one whose
collision resistance reduces to SIS at ~200-bit security per the LKNR
paper.

### Multiset semantics

LtHash is a multiset hash. The `add`/`remove` API does not detect or
reject duplicate adds; callers must guarantee that the same element is
not added twice or removed when not present. `SpaceRepo` and
`SpaceMembers` already uphold this contract.

The lattice analog of XOR's "even add cancels" only triggers after
2^16 duplicate adds of the same element, which is not a meaningful
concern in honest operation and not weaker than XOR's behavior.

## Architecture

### `packages/space/src/lthash.ts` (new)

A standalone primitive with no dependencies outside `@noble/hashes`.

```ts
const LANES = 1024
const STATE_BYTES = LANES * 2  // 2048

export class LtHash {
  private state: Uint16Array  // length 1024

  constructor(init?: Uint8Array)  // init must be 2048 bytes if provided

  add(element: Uint8Array | string): void
  remove(element: Uint8Array | string): void
  toBytes(): Uint8Array            // 2048 LE bytes
  equals(other: LtHash): boolean
}
```

Implementation notes:

- Element expansion uses `blake3` in XOF mode from
  `@noble/hashes/blake3`, which ships in this repo's existing
  `@noble/hashes` dependency. No new package dependency.
  `lukechampine/lthash` uses BLAKE2X; we deviate from that XOF choice
  because BLAKE3 ships native XOF support in noble and SHAKE/BLAKE2X
  do not. This sacrifices byte-for-byte interop with the Go reference,
  but the LtHash *construction* (n=1024, q=2^16, lane-wise modular
  add) is unchanged. The XOF only needs to be a secure XOF; BLAKE3
  qualifies.
- Lane arithmetic is intrinsically mod 2^16 via `Uint16Array` overflow
  on add/subtract.
- Serialization is explicitly little-endian byte writes (not a
  `Uint16Array` view cast) for portability.
- `equals` is a length-checked, byte-wise compare.

### `packages/space/src/set-hash.ts` (rework)

`SetHash` keeps its name and role as the consumer-facing wrapper, with
two changes:

- It composes an `LtHash` internally instead of a raw 32-byte XOR
  buffer.
- It splits state-bytes from commitment-bytes:

```ts
export class SetHash {
  private lt: LtHash

  constructor(state?: Uint8Array)         // 2048 bytes or undefined

  async add(element: string): Promise<void>
  async remove(element: string): Promise<void>

  toBytes(): Buffer    // 2048-byte LtHash state — for storage
  digest(): Buffer     // 32-byte sha256(state) — for the protocol
  equals(other: SetHash): boolean
}
```

The async signatures on `add`/`remove` are retained even though
BLAKE3 is sync, to avoid churn in `SpaceRepo`/`SpaceMembers`.

### `packages/space/src/commit.ts`

The `createCommit`/`verifyCommit` functions HMAC and sign the
**digest** rather than the full state.

```ts
const hash = setHash.digest()             // 32 bytes
const hmac = deriveKeyAndHmac(ikm, hash, space)
```

`SignedCommit.hash` continues to be 32 bytes. No lexicon or wire
schema changes are required.

### Equality checks

Where code currently does
`this.setHash.equals(new SetHash(commit.hash))`, the new check becomes
`commit.hash.equals(this.setHash.digest())`. The 32-byte commit hash
is no longer round-trippable into a `SetHash`; that is correct, since
the lattice state cannot be derived from its sha256 digest. Recovery
of in-memory state happens from local storage, not from a received
commit.

### Storage

`storage/types.ts` renames `getSetHash` to `getSetHashState` and
documents the return as a 2048-byte buffer (or `null`). The two
in-memory implementations
(`storage/memory-repo-storage.ts`,
`storage/memory-members-storage.ts`) are updated accordingly. Anywhere
the storage layer previously persisted `commit.setHash` (32 bytes), it
now persists `setHash.toBytes()` (2048 bytes).

### PDS surface

`packages/pds/src/api/com/atproto/space/getRepoState.ts:31` currently
returns the 32-byte set hash as hex. It continues to return 32 bytes
of hex, but now sourced from `state.setHash.digest()` rather than
`state.setHash`. The 2KB lattice state is internal to a host and is
never exposed externally.

### Documentation

`packages/space/BIG_PICTURE.md` currently describes the commitment as
ECMH. It is updated to:

- name LtHash + sha256-of-state as the construction;
- briefly note the parameter choice (`n=1024`, `q=2^16`);
- note the size tradeoff (~2KB state vs ECMH's ~32 bytes) against the
  operational benefits (fewer dependencies, simpler implementation,
  no hash-to-curve).

## Testing

### `tests/lthash.test.ts` (new)

- Empty `LtHash` serializes to 2048 zero bytes.
- `add(x); remove(x)` restores empty state.
- Order independence of adds across random elements.
- Round-trip: `new LtHash(h.toBytes()).equals(h)`.
- Snapshot vector: a fixed small input set produces a fixed 2048-byte
  state (commit the hex). Locks against accidental algorithm drift.

### `tests/set-hash.test.ts` (extend or new)

- `digest()` is 32 bytes and deterministic for a given state.
- Empty `SetHash`'s digest equals `sha256(zeros_2048)` (snapshot).
- Double-add of the same element does **not** produce the empty state
  (the key correctness improvement over XOR).
- Two `SetHash`es built by adding the same elements in different
  orders produce equal `digest()` values.

### `tests/space.test.ts` (extend)

- Two `SpaceRepo`s reaching the same live record set via different
  operation orders produce equal `SignedCommit.hash` values.
- Adding and then removing a record returns the commit hash to the
  empty-state digest.
- Storage round-trip: persist state, rehydrate `SpaceRepo`, assert
  the same commit hash.

### `commit.ts` regression

- Existing `createCommit`/`verifyCommit` tests pass unchanged.
- Add one assertion that `commit.hash` equals `setHash.digest()`.

## Out of scope

- Promotion of `LtHash` to `@atproto/crypto`. The space package is the
  only consumer today, and it is still pre-stable; the primitive can
  graduate later if reused.
- Changes to lexicon or wire schemas — none are required.
- Compaction or upgrade migration paths. The branch is in active
  development; existing repo state in tests is regenerated.

## Risks

- **Self-implemented primitive.** We own the LtHash code. Mitigated by
  the small surface (~80 lines), order-independence and round-trip
  tests, and snapshot vectors locking the algorithm in place.
- **Endianness.** `Uint16Array`-views over `Uint8Array` differ on
  big-endian machines. Mitigated by explicit little-endian byte
  writes in `toBytes()` and explicit lane assembly in `add`/`remove`.
- **State growth.** Storage per repo grows from 32 bytes to 2048
  bytes. Negligible at expected scale; called out so it is a
  conscious choice rather than a discovery later.
