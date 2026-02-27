import { z } from 'zod'
import { Cid, LexMap, ifCid } from '@atproto/lex-data'
import { NsidString } from '@atproto/syntax'
import { BlockMap } from './block-map'
import { CidSet } from './cid-set'

// Repo nodes
// ---------------

const cidSchema = z.unknown().transform((input, ctx): Cid => {
  const cid = ifCid(input)
  if (cid) return cid

  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    message: 'Not a valid CID',
  })
  return z.NEVER
})

const unsignedCommit = z.object({
  did: z.string(),
  version: z.literal(3),
  data: cidSchema,
  rev: z.string(),
  // `prev` added for backwards compatibility with v2, no requirement of keeping around history
  prev: cidSchema.nullable(),
})
export type UnsignedCommit = z.infer<typeof unsignedCommit> & { sig?: never }

const commit = z.object({
  did: z.string(),
  version: z.literal(3),
  data: cidSchema,
  rev: z.string(),
  prev: cidSchema.nullable(),
  sig: z.instanceof(Uint8Array),
})
export type Commit = z.infer<typeof commit>

const legacyV2Commit = z.object({
  did: z.string(),
  version: z.literal(2),
  data: cidSchema,
  rev: z.string().optional(),
  prev: cidSchema.nullable(),
  sig: z.instanceof(Uint8Array),
})
export type LegacyV2Commit = z.infer<typeof legacyV2Commit>

const versionedCommit = z.discriminatedUnion('version', [
  commit,
  legacyV2Commit,
])
export type VersionedCommit = z.infer<typeof versionedCommit>

export const schema = {
  cid: cidSchema,
  carHeader: z.object({
    version: z.literal(1),
    roots: z.array(cidSchema),
  }),
  bytes: z.instanceof(Uint8Array),
  string: z.string(),
  array: z.array(z.unknown()),
  map: z.record(z.string(), z.unknown()),
  unknown: z.unknown(),
  commit,
  legacyV2Commit,
  versionedCommit,
}

export const def = {
  cid: {
    name: 'cid',
    schema: schema.cid,
  },
  carHeader: {
    name: 'CAR header',
    schema: schema.carHeader,
  },
  bytes: {
    name: 'bytes',
    schema: schema.bytes,
  },
  string: {
    name: 'string',
    schema: schema.string,
  },
  map: {
    name: 'map',
    schema: schema.map,
  },
  unknown: {
    name: 'unknown',
    schema: schema.unknown,
  },
  commit: {
    name: 'commit',
    schema: schema.commit,
  },
  versionedCommit: {
    name: 'versioned_commit',
    schema: schema.versionedCommit,
  },
}

// Repo Operations
// ---------------

export enum WriteOpAction {
  Create = 'create',
  Update = 'update',
  Delete = 'delete',
}

export type RecordCreateOp = {
  action: WriteOpAction.Create
  collection: NsidString
  rkey: string
  record: LexMap
}

export type RecordUpdateOp = {
  action: WriteOpAction.Update
  collection: NsidString
  rkey: string
  record: LexMap
}

export type RecordDeleteOp = {
  action: WriteOpAction.Delete
  collection: NsidString
  rkey: string
}

export type RecordWriteOp = RecordCreateOp | RecordUpdateOp | RecordDeleteOp

export type RecordCreateDescript = {
  action: WriteOpAction.Create
  collection: NsidString
  rkey: string
  cid: Cid
}

export type RecordUpdateDescript = {
  action: WriteOpAction.Update
  collection: NsidString
  rkey: string
  prev: Cid
  cid: Cid
}

export type RecordDeleteDescript = {
  action: WriteOpAction.Delete
  collection: NsidString
  rkey: string
  cid: Cid
}

export type RecordWriteDescript =
  | RecordCreateDescript
  | RecordUpdateDescript
  | RecordDeleteDescript

export type WriteLog = RecordWriteDescript[][]

// Updates/Commits
// ---------------

export type CommitData = {
  cid: Cid
  rev: string
  since: string | null
  prev: Cid | null
  newBlocks: BlockMap
  relevantBlocks: BlockMap
  removedCids: CidSet
}

export type RepoUpdate = CommitData & {
  ops: RecordWriteOp[]
}

export type CollectionContents = Record<string, LexMap>
export type RepoContents = Record<NsidString, CollectionContents>

export type RepoRecordWithCid = { cid: Cid; value: LexMap }
export type CollectionContentsWithCids = Record<string, RepoRecordWithCid>
export type RepoContentsWithCids = Record<string, CollectionContentsWithCids>

export type DatastoreContents = Record<string, Cid>

export type RecordPath = {
  collection: NsidString
  rkey: string
}

export type RecordCidClaim = {
  collection: NsidString
  rkey: string
  cid: Cid | null
}

export type RecordClaim = {
  collection: NsidString
  rkey: string
  record: LexMap | null
}

// Sync
// ---------------

export type VerifiedDiff = {
  writes: RecordWriteDescript[]
  commit: CommitData
}

export type VerifiedRepo = {
  creates: RecordCreateDescript[]
  commit: CommitData
}

export type CarBlock = {
  cid: Cid
  bytes: Uint8Array
}
