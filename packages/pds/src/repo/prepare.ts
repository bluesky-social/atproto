import { CID } from 'multiformats/cid'
import {
  DeleteOp,
  RecordCreateOp,
  RecordUpdateOp,
  RecordWriteOp,
} from '@atproto/repo'
import { AtUri } from '@atproto/uri'
import { cidForData, TID } from '@atproto/common'
import {
  PreparedCreate,
  PreparedUpdate,
  PreparedDelete,
  PreparedWrites,
  BlobRef,
  ImageConstraint,
  InvalidRecordError,
} from './types'

import * as lex from '../lexicon/lexicons'
import { LexiconDefNotFoundError } from '@atproto/lexicon'

// @TODO do this dynamically off of schemas
export const blobsForWrite = (
  write: RecordCreateOp | RecordUpdateOp,
): BlobRef[] => {
  if (write.collection === lex.ids.AppBskyActorProfile) {
    const doc = lex.schemaDict.AppBskyActorProfile
    const refs: BlobRef[] = []
    if (write.value.avatar) {
      refs.push({
        cid: CID.parse(write.value.avatar.cid),
        mimeType: write.value.avatar.mimeType,
        constraints: doc.defs.main.record.properties.avatar as ImageConstraint,
      })
    }
    if (write.value.banner) {
      refs.push({
        cid: CID.parse(write.value.banner.cid),
        mimeType: write.value.banner.mimeType,
        constraints: doc.defs.main.record.properties.banner as ImageConstraint,
      })
    }
    return refs
  } else if (write.collection === lex.ids.AppBskyFeedPost) {
    const refs: BlobRef[] = []
    const embed = write.value?.embed
    if (embed?.$type === 'app.bsky.embed.images') {
      const doc = lex.schemaDict.AppBskyEmbedImages
      for (let i = 0; i < embed.images?.length || 0; i++) {
        const img = embed.images[i]
        refs.push({
          cid: CID.parse(img.image.cid),
          mimeType: img.image.mimeType,
          constraints: doc.defs.image.properties.image as ImageConstraint,
        })
      }
    } else if (
      write.value?.embed?.$type === 'app.bsky.embed.external' &&
      embed.external.thumb?.cid
    ) {
      const doc = lex.schemaDict.AppBskyEmbedExternal
      refs.push({
        cid: CID.parse(embed.external.thumb.cid),
        mimeType: embed.external.thumb.mimeType,
        constraints: doc.defs.external.properties.thumb as ImageConstraint,
      })
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
  record: Record<string, unknown>,
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

export const determineRkey = (collection: string): string => {
  const doc = lex.lexicons.getDef(collection)
  let keyType: string | undefined
  if (doc && doc.type === 'record') {
    keyType = doc.key
  }
  if (keyType && keyType.startsWith('literal')) {
    const split = keyType.split(':')
    return split[1]
  } else {
    return TID.nextStr()
  }
}

export const prepareCreate = async (
  did: string,
  write: RecordCreateOp,
  validate = true,
): Promise<PreparedCreate> => {
  const record = setCollectionName(write.collection, write.value, validate)
  if (validate) {
    assertValidRecord(record)
  }
  const op = {
    ...write,
    value: record,
  }
  return {
    action: 'create',
    uri: AtUri.make(did, write.collection, write.rkey),
    cid: await cidForData(record),
    op,
    blobs: blobsForWrite(op),
  }
}

export const prepareCreates = async (
  did: string,
  writes: RecordCreateOp[],
  validate = true,
): Promise<PreparedCreate[]> => {
  return Promise.all(writes.map((write) => prepareCreate(did, write, validate)))
}

export const prepareUpdate = async (
  did: string,
  write: RecordUpdateOp,
  validate = true,
): Promise<PreparedUpdate> => {
  const record = setCollectionName(write.collection, write.value, validate)
  if (validate) {
    assertValidRecord(record)
  }
  return {
    action: 'update',
    uri: AtUri.make(did, write.collection, write.rkey),
    cid: await cidForData(record),
    op: {
      ...write,
      value: record,
    },
    blobs: blobsForWrite(write),
  }
}

export const prepareDelete = (did: string, write: DeleteOp): PreparedDelete => {
  return {
    action: 'delete',
    uri: AtUri.make(did, write.collection, write.rkey),
    op: write,
  }
}

export const prepareWrites = async (
  did: string,
  writes: RecordWriteOp | RecordWriteOp[],
  validate = true,
): Promise<PreparedWrites> => {
  const writesArr = Array.isArray(writes) ? writes : [writes]
  return Promise.all(
    writesArr.map((write) => {
      if (write.action === 'create') {
        return prepareCreate(did, write, validate)
      } else if (write.action === 'delete') {
        return prepareDelete(did, write)
      } else if (write.action === 'update') {
        return prepareUpdate(did, write, validate)
      } else {
        throw new Error(`Action not supported: ${write}`)
      }
    }),
  )
}
