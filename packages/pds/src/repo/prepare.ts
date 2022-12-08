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
} from './types'

import { ids as lexIds } from '../lexicon/lexicons'

// @TODO do this dynamically off of schemas
export const blobsForWrite = (
  write: RecordCreateOp | RecordUpdateOp,
): BlobRef[] => {
  if (write.collection === lexIds.AppBskyActorProfile) {
    if (write.value.avatar) {
      return [
        {
          cid: CID.parse(write.value.avatar.cid),
          mimeType: write.value.avatar.mimeType,
          constraints: {
            type: 'image',
            accept: ['image/png', 'image/jpeg'],
            maxWidth: 500,
            maxHeight: 500,
            maxSize: 300000,
          },
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
