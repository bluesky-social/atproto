import { CID } from 'multiformats/cid'
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
  RecordCreateOp,
  RecordDeleteOp,
  RecordUpdateOp,
  RecordWriteOp,
  WriteOpAction,
  cborToLex,
} from '@atproto/repo'
import {
  AtUri,
  ensureValidDatetime,
  ensureValidRecordKey,
} from '@atproto/syntax'
import { hasExplicitSlur } from '../handle/explicit-slurs'
import * as lex from '../lexicon/lexicons'
import * as AppBskyActorProfile from '../lexicon/types/app/bsky/actor/profile'
import * as AppBskyFeedGenerator from '../lexicon/types/app/bsky/feed/generator'
import * as AppBskyFeedPost from '../lexicon/types/app/bsky/feed/post'
import * as AppBskyGraphList from '../lexicon/types/app/bsky/graph/list'
import * as AppBskyGraphStarterpack from '../lexicon/types/app/bsky/graph/starterpack'
import { isTag } from '../lexicon/types/app/bsky/richtext/facet'
import { asPredicate } from '../lexicon/util'
import {
  InvalidRecordError,
  PreparedBlobRef,
  PreparedCreate,
  PreparedDelete,
  PreparedUpdate,
  PreparedWrite,
  ValidationStatus,
} from './types'

const isValidFeedGenerator = asPredicate(AppBskyFeedGenerator.validateRecord)
const isValidStarterPack = asPredicate(AppBskyGraphStarterpack.validateRecord)
const isValidPost = asPredicate(AppBskyFeedPost.validateRecord)
const isValidList = asPredicate(AppBskyGraphList.validateRecord)
const isValidProfile = asPredicate(AppBskyActorProfile.validateRecord)

export const assertValidRecordWithStatus = (
  record: Record<string, unknown>,
  opts: { requireLexicon: boolean },
): ValidationStatus => {
  if (typeof record.$type !== 'string') {
    throw new InvalidRecordError('No $type provided')
  }
  try {
    lex.lexicons.assertValidRecord(record.$type, record)
    assertValidCreatedAt(record)
  } catch (e) {
    if (e instanceof LexiconDefNotFoundError) {
      if (opts.requireLexicon) {
        throw new InvalidRecordError(e.message)
      } else {
        return 'unknown'
      }
    }
    throw new InvalidRecordError(
      `Invalid ${record.$type} record: ${
        e instanceof Error ? e.message : String(e)
      }`,
    )
  }
  return 'valid'
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
  const { did, collection, swapCid, validate } = opts
  const maybeValidate = validate !== false
  const record = setCollectionName(collection, opts.record, maybeValidate)
  let validationStatus: ValidationStatus
  if (maybeValidate) {
    validationStatus = assertValidRecordWithStatus(record, {
      requireLexicon: validate === true,
    })
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
    blobs: blobsForWrite(record, maybeValidate),
    validationStatus,
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
  const { did, collection, rkey, swapCid, validate } = opts
  const maybeValidate = validate !== false
  const record = setCollectionName(collection, opts.record, maybeValidate)
  let validationStatus: ValidationStatus
  if (maybeValidate) {
    validationStatus = assertValidRecordWithStatus(record, {
      requireLexicon: validate === true,
    })
  }
  assertNoExplicitSlurs(rkey, record)
  return {
    action: WriteOpAction.Update,
    uri: AtUri.make(did, collection, rkey),
    cid: await cidForSafeRecord(record),
    swapCid,
    record,
    blobs: blobsForWrite(record, maybeValidate),
    validationStatus,
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
  const toCheck: string[] = []

  if (isValidProfile(record)) {
    if (record.displayName) toCheck.push(record.displayName)
  } else if (isValidList(record)) {
    toCheck.push(record.name)
  } else if (isValidStarterPack(record)) {
    toCheck.push(record.name)
  } else if (isValidFeedGenerator(record)) {
    toCheck.push(rkey)
    toCheck.push(record.displayName)
  } else if (isValidPost(record)) {
    if (record.tags) {
      toCheck.push(...record.tags)
    }

    for (const facet of record.facets || []) {
      for (const feat of facet.features) {
        if (isTag(feat)) {
          toCheck.push(feat.tag)
        }
      }
    }
  }
  if (hasExplicitSlur(toCheck.join(' '))) {
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
    size: ref.size,
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
