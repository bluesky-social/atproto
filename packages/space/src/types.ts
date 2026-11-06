import type { Cid, LexMap } from '@atproto/lex-data'
import type { ReadStarOptions } from '@atproto/star'
import type {
  DidString,
  NsidString,
  RecordKeyString,
  SpaceRefString,
} from '@atproto/syntax'
import {
  repoStarMetaSchema,
  spaceMetaStarMetaSchema,
  spaceMetaWriterSchema,
} from './schemas.js'

export {
  REPO_STAR_TYPE,
  SPACE_META_STAR_TYPE,
  SPACE_META_VERSION,
} from './constants.js'

export type Def<T> = {
  name: string
  schema: { parse: (data: unknown) => T }
}

export type InferDef<D> = D extends Def<infer T> ? T : never

function buildDef<T>(name: string, schema: Def<T>['schema']): Def<T> {
  return { name, schema }
}

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

// @NOTE A commit is only ever parsed as part of a repo's STAR archive metadata
// (see `defs.repoStarMeta`), so there is no need for a commitSchema.
export type Commit = {
  ver: number
  repo: DidString
  space: SpaceRefString
  rev: string
  data: Uint8Array
}

export const REPO_STAR_LIMITS: ReadStarOptions = {
  maxMetaLength: 64 * 1024, // 64 KiB
  maxKeyLength: 4 * 1024, // 4 KiB
  maxValueLength: MAX_RECORD_SIZE,
}

// The metadata of a repo's STAR archive: the repo's commit, typed by its profile.
const repoStarMeta = buildDef('repo metadata', repoStarMetaSchema)
export type RepoStarMeta = InferDef<typeof repoStarMeta>

export const SPACE_META_STAR_LIMITS: ReadStarOptions = {
  maxMetaLength: 64 * 1024, // 64 KiB
  maxKeyLength: 4 * 1024, // 4 KiB
  maxValueLength: 1024 * 1024, // 1 MiB
}

// The metadata of a space meta archive.
const spaceMetaStarMeta = buildDef(
  'space meta archive metadata',
  spaceMetaStarMetaSchema,
)
export type SpaceMetaStarMeta = InferDef<typeof spaceMetaStarMeta>

// A repo in the writer set, as listRepos reports it. Keyed by the repo's DID.
const spaceMetaWriter = buildDef('writer', spaceMetaWriterSchema)

export const defs = {
  repoStarMeta,
  spaceMetaStarMeta,
  spaceMetaWriter,
}
