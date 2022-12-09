import { CID } from 'multiformats/cid'
import {
  DeleteOp,
  RecordCreateOp,
  RecordUpdateOp,
  RecordWriteOp,
} from '@atproto/repo'
import { AtUri } from '@atproto/uri'
import { cidForData } from '@atproto/common'
import {
  PreparedCreate,
  PreparedUpdate,
  PreparedDelete,
  PreparedWrites,
  BlobRef,
  ImageConstraint,
} from './types'

import * as lex from '../lexicon/lexicons'

// @TODO do this dynamically off of schemas
export const blobsForWrite = (
  write: RecordCreateOp | RecordUpdateOp,
): BlobRef[] => {
  if (write.collection === lex.ids.AppBskyActorProfile) {
    if (write.value.avatar) {
      const doc = lex.schemaDict.AppBskyActorProfile
      return [
        {
          cid: CID.parse(write.value.avatar.cid),
          mimeType: write.value.avatar.mimeType,
          constraints: doc.defs.main.record.properties
            .avatar as ImageConstraint,
        },
        {
          cid: CID.parse(write.value.banner.cid),
          mimeType: write.value.banner.mimeType,
          constraints: doc.defs.main.record.properties
            .banner as ImageConstraint,
        },
      ]
    }
  }
  return []
}

export const prepareCreate = async (
  did: string,
  write: RecordCreateOp,
): Promise<PreparedCreate> => {
  write.value.$type = write.collection
  return {
    action: 'create',
    uri: AtUri.make(did, write.collection, write.rkey),
    cid: await cidForData(write.value),
    op: write,
    blobs: blobsForWrite(write),
  }
}

export const prepareCreates = async (
  did: string,
  writes: RecordCreateOp[],
): Promise<PreparedCreate[]> => {
  return Promise.all(writes.map((write) => prepareCreate(did, write)))
}

export const prepareUpdate = async (
  did: string,
  write: RecordUpdateOp,
): Promise<PreparedUpdate> => {
  write.value.$type = write.collection
  return {
    action: 'update',
    uri: AtUri.make(did, write.collection, write.rkey),
    cid: await cidForData(write.value),
    op: write,
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
): Promise<PreparedWrites> => {
  const writesArr = Array.isArray(writes) ? writes : [writes]
  return Promise.all(
    writesArr.map((write) => {
      if (write.action === 'create') {
        return prepareCreate(did, write)
      } else if (write.action === 'delete') {
        return prepareDelete(did, write)
      } else if (write.action === 'update') {
        return prepareUpdate(did, write)
      } else {
        throw new Error(`Action not supported: ${write}`)
      }
    }),
  )
}
