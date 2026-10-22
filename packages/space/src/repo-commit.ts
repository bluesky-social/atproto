import { type Cid, ui8Equals } from '@atproto/lex-data'
import type { NsidString, RecordKeyString } from '@atproto/syntax'
import { LtHash } from './lthash.js'
import { verifyCommitMac } from './mac.js'
import {
  COMMIT_VERSION,
  type Commit,
  type CommitCtx,
  type RecordPathParts,
  type RepoOp,
} from './types.js'
import { formatSetHashElement } from './util.js'

export class RepoCommit {
  constructor(public setHash: LtHash = new LtHash()) {}

  // nullish state yields an empty repo
  static fromState(state: Uint8Array | null | undefined): RepoCommit {
    return new RepoCommit(new LtHash(state))
  }

  static fromRecords(
    records: Iterable<RecordPathParts & { cid: Cid }>,
  ): RepoCommit {
    const commit = new RepoCommit()
    for (const { collection, rkey, cid } of records) {
      commit.add(collection, rkey, cid)
    }
    return commit
  }

  add(collection: NsidString, rkey: RecordKeyString, cid: Cid): this {
    this.setHash.add(formatSetHashElement(collection, rkey, cid))
    return this
  }

  remove(collection: NsidString, rkey: RecordKeyString, cid: Cid): this {
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
   * Whether this repo's contents match a commit. Verify the commit first — on its
   * own this says nothing about authenticity.
   */
  matches(commit: Commit): boolean {
    return ui8Equals(this.setHash.digest(), commit.data)
  }

  /**
   * Build a commit over the current contents. A commit carries no signature: the
   * repo host authenticates it to each syncer with a MAC (see `mac.ts`).
   */
  toCommit(ctx: CommitCtx): Commit {
    return {
      ver: COMMIT_VERSION,
      repo: ctx.repo,
      space: ctx.space,
      rev: ctx.rev,
      data: this.setHash.digest(),
    }
  }
}

export type VerifyCommitParams = {
  // The space and repo that were requested.
  space: string
  repo: string
  // The shared secret for the request, and the MAC from its response header.
  sharedSecret: Uint8Array
  mac: Uint8Array
}

/**
 * Verify a commit against the MAC its response carried. Once this passes, `data`
 * is trusted as the author's claim about their repo, which is what makes
 * {@link RepoCommit#matches} meaningful.
 */
export const verifyCommit = (
  commit: Commit,
  params: VerifyCommitParams,
): boolean => {
  if (commit.ver !== COMMIT_VERSION) return false
  if (commit.repo !== params.repo) return false
  if (commit.space !== params.space) return false
  return verifyCommitMac(params.sharedSecret, commit, params.mac)
}
