import { CID } from 'multiformats/cid'

export class MissingBlockError extends Error {
  constructor(
    public cid: CID,
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
    public cids: CID[],
  ) {
    const cidStr = cids.map((c) => c.toString())
    super(`missing ${context} blocks: ${cidStr}`)
  }
}

export class MissingCommitBlocksError extends Error {
  constructor(
    public commit: CID,
    public cids: CID[],
  ) {
    const cidStr = cids.map((c) => c.toString())
    super(`missing blocks for commit ${commit.toString()}: ${cidStr}`)
  }
}

export class UnexpectedObjectError extends Error {
  constructor(
    public cid: CID,
    public def: string,
  ) {
    super(`unexpected object at ${cid.toString()}, expected: ${def}`)
  }
}
