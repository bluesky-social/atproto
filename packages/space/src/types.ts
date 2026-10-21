import { z } from 'zod'
import type { Cid, LexMap } from '@atproto/lex-data'
import type { NsidString, RecordKeyString } from '@atproto/syntax'

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

// The maximum size of a record's DRISL encoding.
export const MAX_RECORD_SIZE = 1024 * 1024 // 1 MiB

export type CommitCtx = {
  space: string
  author: string
  rev: string
}

export type RecordPath<
  TCollection extends NsidString = NsidString,
  TRkey extends RecordKeyString = RecordKeyString,
> = `${TCollection}/${TRkey}`

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

export const REPO_STAR_TYPE = 'atproto-space-repo'

// The metadata of a repo's STAR archive: the signed commit and the context it was
// signed over.
const repoStarMetaSchema = signedCommitSchema.extend({
  $type: z.literal(REPO_STAR_TYPE),
  did: z.string(),
  space: z.string(),
})
export type RepoStarMeta = z.infer<typeof repoStarMetaSchema>

export type Def<T> = {
  name: string
  schema: { parse: (data: unknown) => T }
}

export const defs = {
  signedCommit: {
    name: 'signed commit',
    schema: signedCommitSchema,
  },
  repoStarMeta: {
    name: 'repo metadata',
    schema: repoStarMetaSchema,
  },
} satisfies Record<string, Def<unknown>>
