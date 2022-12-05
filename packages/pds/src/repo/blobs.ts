import { CID } from 'multiformats/cid'
import { BlobStore } from '@atproto/repo'
import Database from '../db'
import { cidForData } from '@atproto/common'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { AtUri } from '@atproto/uri'
import { BlobRef, PreparedWrites } from './types'
import { Blob as BlobTable } from '../db/tables/blob'

export const addUntetheredBlob = async (
  dbTxn: Database,
  blobs: BlobStore,
  mimeType: string,
  bytes: Uint8Array,
): Promise<CID> => {
  const tempKey = await blobs.putTempBytes(bytes)
  // @TODO calcualte cid with chunking
  const cid = await cidForData(bytes)
  await dbTxn.db
    .insertInto('blob')
    .values({
      cid: cid.toString(),
      mimeType,
      size: bytes.length,
      tempKey,
      width: null,
      height: null,
      createdAt: new Date().toISOString(),
    })
    .execute()
  return cid
}

export const processWriteBlobs = async (
  dbTxn: Database,
  blobstore: BlobStore,
  did: string,
  commit: CID,
  writes: PreparedWrites,
) => {
  const blobPromises: Promise<void>[] = []
  for (const write of writes) {
    if (write.action === 'create' || write.action === 'update') {
      for (const blob of write.blobs) {
        blobPromises.push(verifyBlobAndMakePermanent(dbTxn, blobstore, blob))
        blobPromises.push(associateBlob(dbTxn, blob, write.uri, commit, did))
      }
    }
  }
  await Promise.all(blobPromises)
}

export const verifyBlob = (blob: BlobRef, found: BlobTable) => {
  const throwInvalid = (msg: string) => {
    throw new InvalidRequestError(msg, 'InvalidBlob')
  }
  if (blob.constraints.maxSize && found.size > blob.constraints.maxSize) {
    throwInvalid(
      `Blob to large. Expected ${blob.constraints.maxSize}. Got: ${found.size}`,
    )
  }
  if (blob.mimeType !== found.mimeType) {
    throwInvalid(
      `Referenced Mimetype does not match stored blob. Expected: ${found.mimeType}, Got: ${blob.mimeType}`,
    )
  }
  if (
    blob.constraints.accept &&
    !acceptedMime(blob.mimeType, blob.constraints.accept)
  ) {
    throwInvalid(
      `Referenced Mimetype is not accepted. Expected: ${blob.constraints.accept}, Got: ${blob.mimeType}`,
    )
  }
  if (blob.constraints.type === 'image') {
    if (!blob.mimeType.startsWith('image')) {
      throwInvalid(`Expected an image, got ${blob.mimeType}`)
    }
    if (
      blob.constraints.maxHeight &&
      found.height &&
      found.height > blob.constraints.maxHeight
    ) {
      throwInvalid(
        `Referenced image height is too large. Expected: ${blob.constraints.maxHeight}. Got: ${found.height}`,
      )
    }
    if (
      blob.constraints.maxWidth &&
      found.width &&
      found.width > blob.constraints.maxWidth
    ) {
      throwInvalid(
        `Referenced image width is too large. Expected: ${blob.constraints.maxWidth}. Got: ${found.width}`,
      )
    }
  }
}

const acceptedMime = (mime: string, accepted: string[]): boolean => {
  if (accepted.indexOf('*/*') > -1) return true
  return accepted.indexOf(mime) > -1
}

export const verifyBlobAndMakePermanent = async (
  dbTxn: Database,
  blobstore: BlobStore,
  blob: BlobRef,
): Promise<void> => {
  const found = await dbTxn.db
    .selectFrom('blob')
    .selectAll()
    .where('cid', '=', blob.cid.toString())
    .executeTakeFirst()
  if (!found) {
    throw new InvalidRequestError(
      `Could not found blob: ${blob.cid.toString()}`,
      'BlobNotFound',
    )
  }
  if (found.tempKey) {
    verifyBlob(blob, found)
    if (blob.constraints.maxSize) {
      if (found.size > blob.constraints.maxSize) {
        throw new InvalidRequestError(
          `Blob to large. Expected ${blob.constraints.maxSize}. Got: ${found.size}`,
          'InvalidBlob',
        )
      }
    }
    await blobstore.moveToPermanent(found.tempKey, blob.cid)
    await dbTxn.db
      .updateTable('blob')
      .set({ tempKey: null })
      .where('tempKey', '=', found.tempKey)
      .execute()
  }
}

export const associateBlob = async (
  dbTxn: Database,
  blob: BlobRef,
  recordUri: AtUri,
  commit: CID,
  did: string,
): Promise<void> => {
  await dbTxn.db
    .insertInto('repo_blob')
    .values({
      cid: blob.cid.toString(),
      recordUri: recordUri.toString(),
      commit: commit.toString(),
      did,
    })
    .onConflict((oc) => oc.doNothing())
    .execute()
}

export class CidNotFound extends Error {
  cid: CID
  constructor(cid: CID) {
    super(`cid not found: ${cid.toString()}`)
    this.cid = cid
  }
}
