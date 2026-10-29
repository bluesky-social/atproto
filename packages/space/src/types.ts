import { z } from 'zod'
import type { Cid, LexMap } from '@atproto/lex-data'
import {
  type DidString,
  type NsidString,
  type RecordKeyString,
  type SpaceRefString,
  isSpaceRefString,
  isValidDid,
  isValidTid,
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

export const SPACE_HOST_STAR_TYPE = 'atproto-space-host'
export const SPACE_HOST_VERSION = 1

const tidSchema = z.string().refine(isValidTid, 'must be a TID')

// The metadata of a space host archive.
const spaceHostStarMetaSchema = z.object({
  $type: z.literal(SPACE_HOST_STAR_TYPE),
  ver: z.literal(SPACE_HOST_VERSION),
  space: z.custom<SpaceRefString>(isSpaceRefString),
})
export type SpaceHostStarMeta = z.infer<typeof spaceHostStarMetaSchema>

// A repo in the writer set, as listRepos reports it. Keyed by the repo's DID.
const spaceHostWriterSchema = z.object({
  rev: tidSchema,
  data: bytesSchema,
  spaceRev: tidSchema,
})

export type Def<T> = {
  name: string
  schema: { parse: (data: unknown) => T }
}

export const defs = {
  repoStarMeta: {
    name: 'repo metadata',
    schema: repoStarMetaSchema,
  },
  spaceHostStarMeta: {
    name: 'space host metadata',
    schema: spaceHostStarMetaSchema,
  },
  spaceHostWriter: {
    name: 'writer',
    schema: spaceHostWriterSchema,
  },
} satisfies Record<string, Def<unknown>>
