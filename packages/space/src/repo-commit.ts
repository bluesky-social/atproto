import { type Cid, ui8Equals } from '@atproto/lex-data'
import type {
  DidString,
  NsidString,
  RecordKeyString,
  SpaceRefString,
} from '@atproto/syntax'
import { SpaceRepoVerificationError } from './error.js'
import { LtHash } from './lthash.js'
import { type MacParams, verifyCommitMac } from './mac.js'
import {
  COMMIT_VERSION,
  type CommitCtx,
  type RecordPathParts,
  type RepoOp,
  type SpaceCommit,
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
  matches(commit: SpaceCommit): boolean {
    return ui8Equals(this.setHash.digest(), commit.data)
  }

  /**
   * Build a commit over the current contents. A commit carries no signature: the
   * repo host authenticates it to each syncer with a MAC (see `mac.ts`).
   */
  toCommit(ctx: CommitCtx): SpaceCommit {
    return {
      ver: COMMIT_VERSION,
      repo: ctx.repo,
      space: ctx.space,
      rev: ctx.rev,
      data: this.setHash.digest(),
    }
  }
}

export type VerifyCommitParams = MacParams & {
  // The space and repo that were requested.
  space: SpaceRefString
  repo: DidString
}

/**
 * Verify a commit against the MAC its response carried. Once this passes, `data`
 * is trusted as the author's claim about their repo, which is what makes
 * {@link RepoCommit#matches} meaningful.
 *
 * @throws {SpaceRepoVerificationError} if the commit is not for the requested
 * space and repo, or has an unsupported version
 * @throws {SpaceMacError} if the MAC does not match
 */
export function verifyCommit(
  commit: SpaceCommit,
  params: VerifyCommitParams,
): void {
  if (commit.ver !== COMMIT_VERSION) {
    throw new SpaceRepoVerificationError(
      `unsupported commit version: ${commit.ver}`,
    )
  }
  if (commit.repo !== params.repo) {
    throw new SpaceRepoVerificationError(
      `commit is for another repo: ${commit.repo}`,
    )
  }
  if (commit.space !== params.space) {
    throw new SpaceRepoVerificationError(
      `commit is for another space: ${commit.space}`,
    )
  }
  verifyCommitMac(commit, params)
}
