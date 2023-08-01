import { CID } from 'multiformats/cid'
import { AtUri } from '@atproto/uri'
import { TID, dataToCborBlock } from '@atproto/common'
import {
  LexiconDefNotFoundError,
  RepoRecord,
  lexToIpld,
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
import { isMain as isExternalEmbed } from '../lexicon/types/app/bsky/embed/external'
import { isMain as isImagesEmbed } from '../lexicon/types/app/bsky/embed/images'
import { isMain as isRecordWithMediaEmbed } from '../lexicon/types/app/bsky/embed/recordWithMedia'
import { isRecord as isFeedGenerator } from '../lexicon/types/app/bsky/feed/generator'
import {
  Record as PostRecord,
  isRecord as isPost,
} from '../lexicon/types/app/bsky/feed/post'
import { isRecord as isList } from '../lexicon/types/app/bsky/graph/list'
import { isRecord as isProfile } from '../lexicon/types/app/bsky/actor/profile'
import { hasExplicitSlur } from '../content-reporter/explicit-slurs'
import { InvalidRequestError } from '@atproto/xrpc-server'

// @TODO do this dynamically off of schemas
export const blobsForWrite = (record: unknown): PreparedBlobRef[] => {
  if (isProfile(record)) {
    const doc = lex.schemaDict.AppBskyActorProfile
    const refs: PreparedBlobRef[] = []
    if (record.avatar) {
      refs.push({
        cid: record.avatar.ref,
        mimeType: record.avatar.mimeType,
        constraints: doc.defs.main.record.properties.avatar,
      })
    }
    if (record.banner) {
      refs.push({
        cid: record.banner.ref,
        mimeType: record.banner.mimeType,
        constraints: doc.defs.main.record.properties.banner,
      })
    }
    return refs
  } else if (isFeedGenerator(record)) {
    const doc = lex.schemaDict.AppBskyFeedGenerator
    if (!record.avatar) {
      return []
    }
    return [
      {
        cid: record.avatar.ref,
        mimeType: record.avatar.mimeType,
        constraints: doc.defs.main.record.properties.avatar,
      },
    ]
  } else if (isList(record)) {
    const doc = lex.schemaDict.AppBskyGraphList
    if (!record.avatar) {
      return []
    }
    return [
      {
        cid: record.avatar.ref,
        mimeType: record.avatar.mimeType,
        constraints: doc.defs.main.record.properties.avatar,
      },
    ]
  } else if (isPost(record)) {
    const refs: PreparedBlobRef[] = []
    const embeds = separateEmbeds(record.embed)
    for (const embed of embeds) {
      if (isImagesEmbed(embed)) {
        const doc = lex.schemaDict.AppBskyEmbedImages
        for (let i = 0; i < embed.images.length || 0; i++) {
          const img = embed.images[i]
          refs.push({
            cid: img.image.ref,
            mimeType: img.image.mimeType,
            constraints: doc.defs.image.properties.image,
          })
        }
      } else if (isExternalEmbed(embed) && embed.external.thumb) {
        const doc = lex.schemaDict.AppBskyEmbedExternal
        refs.push({
          cid: embed.external.thumb.ref,
          mimeType: embed.external.thumb.mimeType,
          constraints: doc.defs.external.properties.thumb,
        })
      }
    }
    return refs
  }
  return []
}

export const assertValidRecord = (record: Record<string, unknown>) => {
  if (typeof record.$type !== 'string') {
    throw new InvalidRecordError('No $type provided')
  }
  try {
    lex.lexicons.assertValidRecord(record.$type, record)
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
  if (collection === lex.ids.AppBskyFeedPost && opts.rkey) {
    // @TODO temporary
    throw new InvalidRequestError(
      'Custom rkeys for post records are not currently supported.',
    )
  }

  const rkey = opts.rkey || TID.nextStr()
  assertNoExplicitSlurs(rkey, record)
  return {
    action: WriteOpAction.Create,
    uri: AtUri.make(did, collection, rkey),
    cid: await cidForSafeRecord(record),
    swapCid,
    record,
    blobs: blobsForWrite(record),
  }
}

// only allow PUTs to certain collections
const ALLOWED_PUTS = [
  lex.ids.AppBskyActorProfile,
  lex.ids.AppBskyGraphList,
  lex.ids.AppBskyFeedGenerator,
]

export const prepareUpdate = async (opts: {
  did: string
  collection: string
  rkey: string
  swapCid?: CID | null
  record: RepoRecord
  validate?: boolean
}): Promise<PreparedUpdate> => {
  const { did, collection, rkey, swapCid, validate = true } = opts
  if (!ALLOWED_PUTS.includes(collection)) {
    // @TODO temporary
    throw new InvalidRequestError(
      `Temporarily only accepting updates for collections: ${ALLOWED_PUTS.join(
        ', ',
      )}`,
    )
  }

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
    blobs: blobsForWrite(record),
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

function separateEmbeds(embed: PostRecord['embed']) {
  if (!embed) {
    return []
  }
  if (isRecordWithMediaEmbed(embed)) {
    return [{ $type: lex.ids.AppBskyEmbedRecord, ...embed.record }, embed.media]
  }
  return [embed]
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
  }
  if (hasExplicitSlur(toCheck)) {
    throw new InvalidRecordError('Unacceptable slur in record')
  }
}
