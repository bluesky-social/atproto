import { z } from 'zod'
import { type Cid, type LexMap, ifCid } from '@atproto/lex-data'
import type { NsidString, RecordKeyString } from '@atproto/syntax'

export type SpaceRecord = LexMap

export type RecordPath = {
  collection: NsidString
  rkey: RecordKeyString
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

export type IndexKey<
  TCollection extends NsidString = NsidString,
  TRkey extends RecordKeyString = RecordKeyString,
> = `${TCollection}/${TRkey}`

export const isIndexKey = (value: unknown): value is IndexKey => {
  if (typeof value !== 'string') return false
  const slash = value.indexOf('/')
  return (
    slash > 0 &&
    slash < value.length - 1 &&
    value.indexOf('/', slash + 1) === -1
  )
}

export const cidSchema = z.unknown().transform((input, ctx): Cid => {
  const cid = ifCid(input, { flavor: 'cbor' })
  if (cid) return cid

  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    message: 'Not a valid CID',
  })
  return z.NEVER
})

const bytesSchema = z.instanceof(Uint8Array<ArrayBufferLike>)

const signedCommitSchema = z.object({
  ver: z.literal(COMMIT_VERSION),
  hash: bytesSchema,
  ikm: bytesSchema,
  sig: bytesSchema,
  mac: bytesSchema,
  rev: z.string(),
})
export type SignedCommit = z.infer<typeof signedCommitSchema>

const repoIndex = z.record(z.custom<IndexKey>(isIndexKey), cidSchema)
export type RepoIndex = z.infer<typeof repoIndex>

export type Def<T> = {
  name: string
  schema: { parse: (data: unknown) => T }
}

export const defs = {
  signedCommit: {
    name: 'signed commit',
    schema: signedCommitSchema,
  },
  repoIndex: {
    name: 'repo index',
    schema: repoIndex,
  },
} satisfies Record<string, Def<unknown>>
