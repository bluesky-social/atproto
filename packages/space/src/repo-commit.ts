import {
  type Keypair,
  hkdfSha256,
  hmacSha256,
  randomBytes,
  verifySignature,
} from '@atproto/crypto'
import { type Cid, ui8Equals } from '@atproto/lex-data'
import { LtHash } from './lthash.js'
import {
  COMMIT_VERSION,
  type CommitCtx,
  type RecordPath,
  type RepoIndex,
  type RepoOp,
  type SignedCommit,
} from './types.js'
import { formatSetHashElement } from './util.js'

export class RepoCommit {
  constructor(public setHash: LtHash = new LtHash()) {}

  // nullish state yields an empty repo
  static fromState(state: Uint8Array | null | undefined): RepoCommit {
    return new RepoCommit(new LtHash(state))
  }

  static fromRecords(records: Iterable<RecordPath & { cid: Cid }>): RepoCommit {
    const commit = new RepoCommit()
    for (const { collection, rkey, cid } of records) {
      commit.add(collection, rkey, cid)
    }
    return commit
  }

  // Fold in every record an index describes, to compare against a commit.
  static fromIndex(index: RepoIndex): RepoCommit {
    const commit = new RepoCommit()
    for (const [path, cid] of Object.entries(index)) {
      commit.setHash.add(`${path}/${cid.toString()}`)
    }
    return commit
  }

  add(collection: string, rkey: string, cid: Cid): this {
    this.setHash.add(formatSetHashElement(collection, rkey, cid))
    return this
  }

  remove(collection: string, rkey: string, cid: Cid): this {
    this.setHash.remove(formatSetHashElement(collection, rkey, cid))
    return this
  }

  applyOp(op: RepoOp): this {
    if (op.prev) this.remove(op.collection, op.rkey, op.prev)
    if (op.cid) this.add(op.collection, op.rkey, op.cid)
    return this
  }

  applyOps(ops: Iterable<RepoOp>): this {
    for (const op of ops) {
      this.applyOp(op)
    }
    return this
  }

  /**
   * Whether this repo's contents match a signed commit. Verify the commit first —
   * on its own this says nothing about authenticity.
   */
  matches(commit: SignedCommit): boolean {
    return ui8Equals(this.setHash.digest(), commit.hash)
  }

  /**
   * Sign a commit over the current contents.
   *
   * The signature covers only the ctx, never the digest, so a leaked commit proves
   * nothing about what the author wrote. The digest is bound to the ctx by a
   * symmetric MAC instead: readers get integrity, third parties get nothing. A
   * fresh `ikm` per commit means each reader receives a distinct one.
   */
  async sign(ctx: CommitCtx, keypair: Keypair): Promise<SignedCommit> {
    const hash = this.setHash.digest()
    const ikm = randomBytes(32)
    const ctxBytes = encodeCommitCtx(ctx, ikm)
    return {
      ver: COMMIT_VERSION,
      hash,
      ikm,
      mac: computeMac(ikm, ctxBytes, hash),
      sig: await keypair.sign(ctxBytes),
      rev: ctx.rev,
    }
  }
}

/**
 * Verify a commit's signature (authenticity) and MAC (integrity). Once this passes,
 * `hash` is trusted as the author's claim about their repo, which is what makes
 * {@link RepoCommit#matches} meaningful.
 */
export const verifyCommit = async (
  commit: SignedCommit,
  ctx: CommitCtx,
  didKey: string,
): Promise<boolean> => {
  if (commit.ver !== COMMIT_VERSION) return false
  if (commit.rev !== ctx.rev) return false

  const ctxBytes = encodeCommitCtx(ctx, commit.ikm)
  const mac = computeMac(commit.ikm, ctxBytes, commit.hash)
  if (!ui8Equals(mac, commit.mac)) return false

  return verifySignature(didKey, ctxBytes, commit.sig)
}

const computeMac = (
  ikm: Uint8Array,
  ctxBytes: Uint8Array,
  hash: Uint8Array,
): Uint8Array => {
  return hmacSha256(hkdfSha256(ikm, ctxBytes), hash)
}

const DOMAIN_PREFIX = new TextEncoder().encode('atproto-space-v1')

/**
 * ```
 * ctx = "atproto-space-v1"
 *    || uint16be(len(space))  || space
 *    || uint16be(len(author)) || author
 *    || uint16be(len(rev))    || rev
 *    || uint16be(len(ikm))    || ikm
 * ```
 *
 * Length prefixes are big-endian per the TLS variable-length vector convention —
 * deliberately the opposite byte order from the set hash's lanes.
 */
export const encodeCommitCtx = (
  ctx: CommitCtx,
  ikm: Uint8Array,
): Uint8Array => {
  const encoder = new TextEncoder()
  const fields = [
    encoder.encode(ctx.space),
    encoder.encode(ctx.author),
    encoder.encode(ctx.rev),
    ikm,
  ]

  let size = DOMAIN_PREFIX.length
  for (const field of fields) {
    if (field.length > 0xffff) {
      throw new Error('commit ctx field exceeds uint16 length prefix')
    }
    size += 2 + field.length
  }

  const out = new Uint8Array(size)
  out.set(DOMAIN_PREFIX)
  let offset = DOMAIN_PREFIX.length
  for (const field of fields) {
    out[offset++] = (field.length >>> 8) & 0xff
    out[offset++] = field.length & 0xff
    out.set(field, offset)
    offset += field.length
  }
  return out
}
