import { z } from 'zod'
import type { check } from '@atproto/common'
import { type Cid, type LexMap, ifCid } from '@atproto/lex-data'

export type SpaceRecord = LexMap

export type RecordPath = {
  collection: string
  rkey: string
}

// A create has no `prev`, a delete no `cid`, an update both.
export type RepoOp = RecordPath & {
  cid: Cid | null
  prev: Cid | null
}

export const COMMIT_VERSION = 1

export type CommitCtx = {
  space: string
  author: string
  rev: string
}

const cidSchema = z.unknown().transform((input, ctx): Cid => {
  const cid = ifCid(input)
  if (cid) return cid

  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    message: 'Not a valid CID',
  })
  return z.NEVER
})

const bytes = z.instanceof(Uint8Array<ArrayBufferLike>)

const signedCommit = z.object({
  ver: z.literal(COMMIT_VERSION),
  hash: bytes,
  ikm: bytes,
  sig: bytes,
  mac: bytes,
  rev: z.string(),
})
export type SignedCommit = z.infer<typeof signedCommit>

// `{collection}/{rkey}` to the record's cid.
const repoIndex = z.record(z.string(), cidSchema)
export type RepoIndex = z.infer<typeof repoIndex>

export const def = {
  signedCommit: {
    name: 'signed commit',
    schema: signedCommit,
  } as check.Def<SignedCommit>,
  repoIndex: {
    name: 'repo index',
    schema: repoIndex,
  } as check.Def<RepoIndex>,
}
