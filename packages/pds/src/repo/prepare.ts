import { CID } from 'multiformats/cid'
import {
  AtUri,
  ensureValidRecordKey,
  ensureValidDatetime,
} from '@atproto/syntax'
import { TID, check, dataToCborBlock } from '@atproto/common'
import {
  BlobRef,
  LexValue,
  LexiconDefNotFoundError,
  RepoRecord,
  ValidationError,
  lexToIpld,
  untypedJsonBlobRef,
} from '@atproto/lexicon'
import {
  cborToLex,
  RecordDeleteOp,
  RecordCreateOp,
  RecordUpdateOp,
  RecordWriteOp,
  WriteOpAction,
} from '@atproto/repo'
import {
  PreparedCreate,
  PreparedUpdate,
  PreparedDelete,
  InvalidRecordError,
  PreparedWrite,
  PreparedBlobRef,
} from './types'
import * as lex from '../lexicon/lexicons'
import { isRecord as isFeedGenerator } from '../lexicon/types/app/bsky/feed/generator'
import { isRecord as isPost } from '../lexicon/types/app/bsky/feed/post'
import { isTag } from '../lexicon/types/app/bsky/richtext/facet'
import { isRecord as isList } from '../lexicon/types/app/bsky/graph/list'
import { isRecord as isProfile } from '../lexicon/types/app/bsky/actor/profile'
import { hasExplicitSlur } from '../handle/explicit-slurs'

export const assertValidRecord = (record: Record<string, unknown>) => {
  if (typeof record.$type !== 'string') {
    throw new InvalidRecordError('No $type provided')
  }
  try {
    lex.lexicons.assertValidRecord(record.$type, record)
    assertValidCreatedAt(record)
  } catch (e) {
    if (e instanceof LexiconDefNotFoundError) {
      throw new InvalidRecordError(e.message)
    }
    throw new InvalidRecordError(
      `Invalid ${record.$type} record: ${
        e instanceof Error ? e.message : String(e)
      }`,
    )
  }
}

// additional more rigorous check on datetimes
// this check will eventually be in the lex sdk, but this will stop the bleed until then
export const assertValidCreatedAt = (record: Record<string, unknown>) => {
  const createdAt = record['createdAt']
  if (typeof createdAt !== 'string') {
    return
  }
  try {
    ensureValidDatetime(createdAt)
  } catch {
    throw new ValidationError(
      'createdAt must be an valid atproto datetime (both RFC-3339 and ISO-8601)',
    )
  }
}

export const setCollectionName = (
  collection: string,
  record: RepoRecord,
  validate: boolean,
) => {
  if (!record.$type) {
    record.$type = collection
  }
  if (validate && record.$type !== collection) {
    throw new InvalidRecordError(
      `Invalid $type: expected ${collection}, got ${record.$type}`,
    )
  }
  return record
}

export const prepareCreate = async (opts: {
  did: string
  collection: string
  rkey?: string
  swapCid?: CID | null
  record: RepoRecord
  validate?: boolean
}): Promise<PreparedCreate> => {
  const { did, collection, swapCid, validate = true } = opts
  const record = setCollectionName(collection, opts.record, validate)
  if (validate) {
    assertValidRecord(record)
  }

  const nextRkey = TID.next()
  const rkey = opts.rkey || nextRkey.toString()
  // @TODO: validate against Lexicon record 'key' type, not just overall recordkey syntax
  ensureValidRecordKey(rkey)
  assertNoExplicitSlurs(rkey, record)
  return {
    action: WriteOpAction.Create,
    uri: AtUri.make(did, collection, rkey),
    cid: await cidForSafeRecord(record),
    swapCid,
    record,
    blobs: blobsForWrite(record, validate),
  }
}

export const prepareUpdate = async (opts: {
  did: string
  collection: string
  rkey: string
  swapCid?: CID | null
  record: RepoRecord
  validate?: boolean
}): Promise<PreparedUpdate> => {
  const { did, collection, rkey, swapCid, validate = true } = opts
  const record = setCollectionName(collection, opts.record, validate)
  if (validate) {
    assertValidRecord(record)
  }
  assertNoExplicitSlurs(rkey, record)
  return {
    action: WriteOpAction.Update,
    uri: AtUri.make(did, collection, rkey),
    cid: await cidForSafeRecord(record),
    swapCid,
    record,
    blobs: blobsForWrite(record, validate),
  }
}

export const prepareDelete = (opts: {
  did: string
  collection: string
  rkey: string
  swapCid?: CID | null
}): PreparedDelete => {
  const { did, collection, rkey, swapCid } = opts
  return {
    action: WriteOpAction.Delete,
    uri: AtUri.make(did, collection, rkey),
    swapCid,
  }
}

export const createWriteToOp = (write: PreparedCreate): RecordCreateOp => ({
  action: WriteOpAction.Create,
  collection: write.uri.collection,
  rkey: write.uri.rkey,
  record: write.record,
})

export const updateWriteToOp = (write: PreparedUpdate): RecordUpdateOp => ({
  action: WriteOpAction.Update,
  collection: write.uri.collection,
  rkey: write.uri.rkey,
  record: write.record,
})

export const deleteWriteToOp = (write: PreparedDelete): RecordDeleteOp => ({
  action: WriteOpAction.Delete,
  collection: write.uri.collection,
  rkey: write.uri.rkey,
})

export const writeToOp = (write: PreparedWrite): RecordWriteOp => {
  switch (write.action) {
    case WriteOpAction.Create:
      return createWriteToOp(write)
    case WriteOpAction.Update:
      return updateWriteToOp(write)
    case WriteOpAction.Delete:
      return deleteWriteToOp(write)
    default:
      throw new Error(`Unrecognized action: ${write}`)
  }
}

async function cidForSafeRecord(record: RepoRecord) {
  try {
    const block = await dataToCborBlock(lexToIpld(record))
    cborToLex(block.bytes)
    return block.cid
  } catch (err) {
    // Block does not properly transform between lex and cbor
    const badRecordErr = new InvalidRecordError('Bad record')
    badRecordErr.cause = err
    throw badRecordErr
  }
}

function assertNoExplicitSlurs(rkey: string, record: RepoRecord) {
  let toCheck = ''
  if (isProfile(record)) {
    toCheck += ' ' + record.displayName
  } else if (isList(record)) {
    toCheck += ' ' + record.name
  } else if (isFeedGenerator(record)) {
    toCheck += ' ' + rkey
    toCheck += ' ' + record.displayName
  } else if (isPost(record)) {
    if (record.tags) {
      toCheck += record.tags.join(' ')
    }

    for (const facet of record.facets || []) {
      for (const feat of facet.features) {
        if (isTag(feat)) {
          toCheck += ' ' + feat.tag
        }
      }
    }
  }
  if (hasExplicitSlur(toCheck)) {
    throw new InvalidRecordError('Unacceptable slur in record')
  }
}

type FoundBlobRef = {
  ref: BlobRef
  path: string[]
}

export const blobsForWrite = (
  record: RepoRecord,
  validate: boolean,
): PreparedBlobRef[] => {
  const refs = findBlobRefs(record)
  const recordType =
    typeof record['$type'] === 'string' ? record['$type'] : undefined

  for (const ref of refs) {
    if (check.is(ref.ref.original, untypedJsonBlobRef)) {
      throw new InvalidRecordError(`Legacy blob ref at '${ref.path.join('/')}'`)
    }
  }

  return refs.map(({ ref, path }) => ({
    cid: ref.ref,
    mimeType: ref.mimeType,
    constraints:
      validate && recordType
        ? CONSTRAINTS[recordType]?.[path.join('/')] ?? {}
        : {},
  }))
}

export const findBlobRefs = (
  val: LexValue,
  path: string[] = [],
  layer = 0,
): FoundBlobRef[] => {
  if (layer > 32) {
    return []
  }
  // walk arrays
  if (Array.isArray(val)) {
    return val.flatMap((item) => findBlobRefs(item, path, layer + 1))
  }
  // objects
  if (val && typeof val === 'object') {
    // convert blobs, leaving the original encoding so that we don't change CIDs on re-encode
    if (val instanceof BlobRef) {
      return [
        {
          ref: val,
          path,
        },
      ]
    }
    // retain cids & bytes
    if (CID.asCID(val) || val instanceof Uint8Array) {
      return []
    }
    return Object.entries(val).flatMap(([key, item]) =>
      findBlobRefs(item, [...path, key], layer + 1),
    )
  }
  // pass through
  return []
}

const CONSTRAINTS = {
  [lex.ids.AppBskyActorProfile]: {
    avatar:
      lex.schemaDict.AppBskyActorProfile.defs.main.record.properties.avatar,
    banner:
      lex.schemaDict.AppBskyActorProfile.defs.main.record.properties.banner,
  },
  [lex.ids.AppBskyFeedGenerator]: {
    avatar:
      lex.schemaDict.AppBskyFeedGenerator.defs.main.record.properties.avatar,
  },
  [lex.ids.AppBskyGraphList]: {
    avatar: lex.schemaDict.AppBskyGraphList.defs.main.record.properties.avatar,
  },
  [lex.ids.AppBskyFeedPost]: {
    'embed/images/image':
      lex.schemaDict.AppBskyEmbedImages.defs.image.properties.image,
    'embed/external/thumb':
      lex.schemaDict.AppBskyEmbedExternal.defs.external.properties.thumb,
    'embed/media/images/image':
      lex.schemaDict.AppBskyEmbedImages.defs.image.properties.image,
    'embed/media/external/thumb':
      lex.schemaDict.AppBskyEmbedExternal.defs.external.properties.thumb,
  },
}
