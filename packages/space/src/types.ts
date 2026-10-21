import { z } from 'zod'
import { type Cid, type LexMap, ifCid } from '@atproto/lex-data'
import {
  type DidString,
  type NsidString,
  type RecordKeyString,
  type SpaceRefString,
  isSpaceRefString,
  isValidDid,
} from '@atproto/syntax'

export type SpaceRecord = LexMap

export type RecordPathParts = {
  collection: NsidString
  rkey: RecordKeyString
}

// A create has no `prev`, a delete no `cid`, an update both.
export type RepoOp = RecordPathParts & {
  cid: Cid | null
  prev: Cid | null
}

export const COMMIT_VERSION = 1

// Which repo, in which space, at which revision a commit describes.
export type CommitCtx = {
  space: SpaceRefString
  repo: DidString
  rev: string
}

export type RecordPath<
  TCollection extends NsidString = NsidString,
  TRkey extends RecordKeyString = RecordKeyString,
> = `${TCollection}/${TRkey}`

export const isRecordPath = (value: unknown): value is RecordPath => {
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

const commitSchema = z.object({
  ver: z.number(),
  repo: z.custom<DidString>(isValidDid),
  space: z.custom<SpaceRefString>(isSpaceRefString),
  rev: z.string(),
  data: bytesSchema,
})
export type Commit = z.infer<typeof commitSchema>

const repoIndex = z.record(z.custom<RecordPath>(isRecordPath), cidSchema)
export type RepoIndex = z.infer<typeof repoIndex>

export type Def<T> = {
  name: string
  schema: { parse: (data: unknown) => T }
}

export const defs = {
  commit: {
    name: 'commit',
    schema: commitSchema,
  },
  repoIndex: {
    name: 'repo index',
    schema: repoIndex,
  },
} satisfies Record<string, Def<unknown>>
