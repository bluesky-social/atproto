import stream from 'stream'
import { CID } from 'multiformats/cid'
import bytes from 'bytes'
import { fromStream as fileTypeFromStream } from 'file-type'
import { BlobStore, WriteOpAction } from '@atproto/repo'
import { AtUri } from '@atproto/uri'
import { sha256Stream } from '@atproto/crypto'
import { cloneStream, sha256RawToCid, streamSize } from '@atproto/common'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { BlobRef, PreparedWrite } from '../../repo/types'
import Database from '../../db'
import { Blob as BlobTable } from '../../db/tables/blob'
import * as img from '../../image'

export class RepoBlobs {
  constructor(public db: Database, public blobstore: BlobStore) {}

  async addUntetheredBlob(
    mimeType: string,
    blobStream: stream.Readable,
  ): Promise<CID> {
    const [tempKey, size, sha256, imgInfo, fileType] = await Promise.all([
      this.blobstore.putTemp(cloneStream(blobStream)),
      streamSize(cloneStream(blobStream)),
      sha256Stream(cloneStream(blobStream)),
      img.maybeGetInfo(cloneStream(blobStream)),
      fileTypeFromStream(blobStream),
    ])

    const cid = sha256RawToCid(sha256)

    await this.db.db
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

  async processWriteBlobs(did: string, commit: CID, writes: PreparedWrite[]) {
    const blobPromises: Promise<void>[] = []
    for (const write of writes) {
      if (
        write.action === WriteOpAction.Create ||
        write.action === WriteOpAction.Update
      ) {
        for (const blob of write.blobs) {
          blobPromises.push(this.verifyBlobAndMakePermanent(blob))
          blobPromises.push(this.associateBlob(blob, write.uri, commit, did))
        }
      }
    }
    await Promise.all(blobPromises)
  }

  async verifyBlobAndMakePermanent(blob: BlobRef): Promise<void> {
    const found = await this.db.db
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
      await this.blobstore.makePermanent(found.tempKey, blob.cid)
      await this.db.db
        .updateTable('blob')
        .set({ tempKey: null })
        .where('tempKey', '=', found.tempKey)
        .execute()
    }
  }

  async associateBlob(
    blob: BlobRef,
    recordUri: AtUri,
    commit: CID,
    did: string,
  ): Promise<void> {
    await this.db.db
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
}

export class CidNotFound extends Error {
  cid: CID
  constructor(cid: CID) {
    super(`cid not found: ${cid.toString()}`)
    this.cid = cid
  }
}

function acceptedMime(mime: string, accepted: string[]): boolean {
  if (accepted.includes('*/*')) return true
  const globs = accepted.filter((a) => a.endsWith('/*'))
  for (const glob of globs) {
    const [start] = glob.split('/')
    if (mime.startsWith(`${start}/`)) {
      return true
    }
  }
  return accepted.includes(mime)
}

function verifyBlob(blob: BlobRef, found: BlobTable) {
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
