import type { Cid } from '@atproto/lex-data'

export class MissingBlockError extends Error {
  constructor(
    public cid: Cid,
    def?: string,
  ) {
    let msg = `block not found: ${cid.toString()}`
    if (def) {
      msg += `, expected type: ${def}`
    }
    super(msg)
  }
}

export class MissingBlocksError extends Error {
  constructor(
    public context: string,
    public cids: Cid[],
  ) {
    const cidStr = cids.map((c) => c.toString())
    super(`missing ${context} blocks: ${cidStr}`)
  }
}

export class MissingCommitBlocksError extends Error {
  constructor(
    public commit: Cid,
    public cids: Cid[],
  ) {
    const cidStr = cids.map((c) => c.toString())
    super(`missing blocks for commit ${commit.toString()}: ${cidStr}`)
  }
}

// Thrown by `CidSet.markVisited` when a CID is recorded a second time. For MST
// traversals this means the tree references the same node more than once,
// which a valid tree never does.
export class VisitedCidError extends Error {
  constructor(public cid: Cid) {
    super(`cid visited more than once: ${cid.toString()}`)
  }
}

export class UnexpectedObjectError extends Error {
  constructor(
    public cid: Cid,
    public def: string,
  ) {
    super(`unexpected object at ${cid.toString()}, expected: ${def}`)
  }
}
