import stream from 'stream'
import { CID } from 'multiformats/cid'
import { BlobStore } from '@atproto/repo'
import bytes from 'bytes'
import Database from '../db'
import { cloneStream, sha256RawToCid, streamSize } from '@atproto/common'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { AtUri } from '@atproto/uri'
import { BlobRef, PreparedWrites } from './types'
import { Blob as BlobTable } from '../db/tables/blob'
import * as img from '../image'
import { sha256Stream } from '@atproto/crypto'
import { fromStream as fileTypeFromStream } from 'file-type'

export const addUntetheredBlob = async (
  dbTxn: Database,
  blobstore: BlobStore,
  mimeType: string,
  blobStream: stream.Readable,
): Promise<CID> => {
  const [tempKey, size, sha256, imgInfo, fileType] = await Promise.all([
    blobstore.putTemp(cloneStream(blobStream)),
    streamSize(cloneStream(blobStream)),
    sha256Stream(cloneStream(blobStream)),
    img.maybeGetInfo(cloneStream(blobStream)),
    fileTypeFromStream(blobStream),
  ])

  const cid = sha256RawToCid(sha256)

  await dbTxn.db
    .insertInto('blob')
    .values({
      cid: cid.toString(),
      mimeType: fileType?.mime || mimeType,
      size,
      tempKey,
      width: imgInfo?.width || null,
      height: imgInfo?.height || null,
      createdAt: new Date().toISOString(),
    })
    .onConflict((oc) =>
      oc
        .column('cid')
        .doUpdateSet({ tempKey })
        .where('blob.tempKey', 'is not', null),
    )
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
  const throwInvalid = (msg: string, errName = 'InvalidBlob') => {
    throw new InvalidRequestError(msg, errName)
  }
  if (blob.constraints.maxSize && found.size > blob.constraints.maxSize) {
    throwInvalid(
      `This file is too large. It is ${bytes.format(
        found.size,
      )} but the maximum size is ${bytes.format(blob.constraints.maxSize)}.`,
      'BlobTooLarge',
    )
  }
  if (blob.mimeType !== found.mimeType) {
    throwInvalid(
      `Referenced Mimetype does not match stored blob. Expected: ${found.mimeType}, Got: ${blob.mimeType}`,
      'InvalidMimeType',
    )
  }
  if (
    blob.constraints.accept &&
    !acceptedMime(blob.mimeType, blob.constraints.accept)
  ) {
    throwInvalid(
      `Wrong type of file. It is ${blob.mimeType} but it must match ${blob.constraints.accept}.`,
      'InvalidMimeType',
    )
  }
  if (blob.constraints.type === 'image') {
    if (!blob.mimeType.startsWith('image')) {
      throwInvalid(
        `Wrong type of file. Expected an image, got ${blob.mimeType}`,
        'InvalidMimeType',
      )
    }
    if (
      blob.constraints.maxHeight &&
      found.height &&
      found.height > blob.constraints.maxHeight
    ) {
      throwInvalid(
        `This image is too tall. It is ${found.height} pixels high, but the limit is ${blob.constraints.maxHeight} pixels.`,
        'InvalidImageDimensions',
      )
    }
    if (
      blob.constraints.maxWidth &&
      found.width &&
      found.width > blob.constraints.maxWidth
    ) {
      throwInvalid(
        `This image is too wide. It is ${found.width} pixels wide, but the limit is ${blob.constraints.maxWidth} pixels.`,
        'InvalidImageDimensions',
      )
    }
    if (
      blob.constraints.minHeight &&
      found.height &&
      found.height < blob.constraints.minHeight
    ) {
      throwInvalid(
        `This image is too short. It is ${found.height} pixels high, but the limit is ${blob.constraints.minHeight} pixels.`,
        'InvalidImageDimensions',
      )
    }
    if (
      blob.constraints.minWidth &&
      found.width &&
      found.width < blob.constraints.minWidth
    ) {
      throwInvalid(
        `This image is too narrow. It is ${found.width} pixels wide, but the limit is ${blob.constraints.minWidth} pixels.`,
        'InvalidImageDimensions',
      )
    }
  }
}

const acceptedMime = (mime: string, accepted: string[]): boolean => {
  if (accepted.includes('*/*')) return true
  return accepted.includes(mime)
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
      `Could not find blob: ${blob.cid.toString()}`,
      'BlobNotFound',
    )
  }
  if (found.tempKey) {
    verifyBlob(blob, found)
    await blobstore.makePermanent(found.tempKey, blob.cid)
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
