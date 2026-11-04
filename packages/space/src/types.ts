import type { Cid, LexMap } from '@atproto/lex-data'
import { l } from '@atproto/lex-schema'
import type {
  DidString,
  NsidString,
  RecordKeyString,
  SpaceRefString,
  TidString,
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
  rev: TidString
}

export type RecordPathString<
  TCollection extends NsidString = NsidString,
  TRkey extends RecordKeyString = RecordKeyString,
> = `${TCollection}/${TRkey}`

// Matches `com.atproto.space.defs#commit`.
const commitSchema = l.object({
  ver: l.integer(),
  repo: l.string({ format: 'did' }),
  space: l.string({ format: 'space-ref' }),
  rev: l.string({ format: 'tid' }),
  data: l.bytes(),
})
export type SpaceCommit = l.Infer<typeof commitSchema>

export const REPO_STAR_TYPE = 'atproto-space-repo'

// The metadata of a repo's STAR archive: the repo's commit, typed by its profile.
const repoStarMetaSchema = l.object({
  $type: l.literal(REPO_STAR_TYPE),
  ...commitSchema.shape,
})
export type RepoStarMeta = l.Infer<typeof repoStarMetaSchema>

export const SPACE_META_STAR_TYPE = 'atproto-space-meta'
export const SPACE_META_VERSION = 1

// The metadata of a space meta archive.
const spaceMetaStarMetaSchema = l.object({
  $type: l.literal(SPACE_META_STAR_TYPE),
  ver: l.literal(SPACE_META_VERSION),
  space: l.string({ format: 'space-ref' }),
})
export type SpaceMetaStarMeta = l.Infer<typeof spaceMetaStarMetaSchema>

// A repo in the writer set, as listWriters reports it. Keyed by the repo's DID.
const spaceMetaWriterSchema = l.object({
  repoRev: l.string({ format: 'tid' }),
  data: l.bytes(),
  spaceRev: l.string({ format: 'tid' }),
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
  spaceMetaStarMeta: {
    name: 'space meta archive metadata',
    schema: spaceMetaStarMetaSchema,
  },
  spaceMetaWriter: {
    name: 'writer',
    schema: spaceMetaWriterSchema,
  },
} satisfies Record<string, Def<unknown>>
