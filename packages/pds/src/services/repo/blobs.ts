import stream from 'stream'
import { CID } from 'multiformats/cid'
import { fileTypeFromStream } from 'file-type'
import { BlobStore } from '@atproto/repo'
import { AtUri } from '@atproto/uri'
import { sha256Stream } from '@atproto/crypto'
import { cloneStream, sha256RawToCid, streamSize } from '@atproto/common'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { BlobRef, PreparedWrites } from '../../repo/types'
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

  async processWriteBlobs(did: string, commit: CID, writes: PreparedWrites) {
    const blobPromises: Promise<void>[] = []
    for (const write of writes) {
      if (write.action === 'create' || write.action === 'update') {
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
  return accepted.includes(mime)
}

function verifyBlob(blob: BlobRef, found: BlobTable) {
  const throwInvalid = (msg: string) => {
    throw new InvalidRequestError(msg, 'InvalidBlob')
  }
  if (blob.constraints.maxSize && found.size > blob.constraints.maxSize) {
    throwInvalid(
      `Blob too large. Expected ${blob.constraints.maxSize}. Got: ${found.size}`,
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
    if (
      blob.constraints.minHeight &&
      found.height &&
      found.height < blob.constraints.minHeight
    ) {
      throwInvalid(
        `Referenced image height is too small. Expected: ${blob.constraints.minHeight}. Got: ${found.height}`,
      )
    }
    if (
      blob.constraints.minWidth &&
      found.width &&
      found.width < blob.constraints.minWidth
    ) {
      throwInvalid(
        `Referenced image width is too small. Expected: ${blob.constraints.minWidth}. Got: ${found.width}`,
      )
    }
  }
}
