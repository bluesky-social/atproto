import { z } from 'zod'
import type { Cid, LexMap } from '@atproto/lex-data'
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

// The maximum size of a record's DRISL encoding.
export const MAX_RECORD_SIZE = 1024 * 1024 // 1 MiB

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

const bytesSchema = z.instanceof(Uint8Array<ArrayBufferLike>)

const commitSchema = z.object({
  ver: z.number(),
  repo: z.custom<DidString>(isValidDid),
  space: z.custom<SpaceRefString>(isSpaceRefString),
  rev: z.string(),
  data: bytesSchema,
})
export type Commit = z.infer<typeof commitSchema>

export const REPO_STAR_TYPE = 'atproto-space-repo'

// The metadata of a repo's STAR archive: the repo's commit, typed by its profile.
const repoStarMetaSchema = commitSchema.extend({
  $type: z.literal(REPO_STAR_TYPE),
})
export type RepoStarMeta = z.infer<typeof repoStarMetaSchema>

export type Def<T> = {
  name: string
  schema: { parse: (data: unknown) => T }
}

export const defs = {
  repoStarMeta: {
    name: 'repo metadata',
    schema: repoStarMetaSchema,
  },
} satisfies Record<string, Def<unknown>>
