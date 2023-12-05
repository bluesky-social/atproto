import stream from 'stream'
import crypto from 'crypto'
import { CID } from 'multiformats/cid'
import bytes from 'bytes'
import { fromStream as fileTypeFromStream } from 'file-type'
import { BlobNotFoundError, BlobStore, WriteOpAction } from '@atproto/repo'
import { AtUri } from '@atproto/syntax'
import { cloneStream, sha256RawToCid, streamSize } from '@atproto/common'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { BlobRef } from '@atproto/lexicon'
import { ActorDb, Blob as BlobTable } from '../db'
import {
  PreparedBlobRef,
  PreparedWrite,
  PreparedDelete,
  PreparedUpdate,
} from '../../repo/types'
import * as img from '../../image'
import { BackgroundQueue } from '../../background'
import { BlobReader } from './reader'
import { StatusAttr } from '../../lexicon/types/com/atproto/admin/defs'

export class BlobTransactor extends BlobReader {
  constructor(
    public db: ActorDb,
    public blobstore: BlobStore,
    public backgroundQueue: BackgroundQueue,
  ) {
    super(db, blobstore)
  }

  async addUntetheredBlob(
    userSuggestedMime: string,
    blobStream: stream.Readable,
  ): Promise<BlobRef> {
    const [tempKey, size, sha256, imgInfo, sniffedMime] = await Promise.all([
      this.blobstore.putTemp(cloneStream(blobStream)),
      streamSize(cloneStream(blobStream)),
      sha256Stream(cloneStream(blobStream)),
      img.maybeGetInfo(cloneStream(blobStream)),
      mimeTypeFromStream(cloneStream(blobStream)),
    ])

    const cid = sha256RawToCid(sha256)
    const mimeType = sniffedMime || userSuggestedMime

    await this.db.db
      .insertInto('blob')
      .values({
        cid: cid.toString(),
        mimeType,
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
    return new BlobRef(cid, mimeType, size)
  }

  async processWriteBlobs(rev: string, writes: PreparedWrite[]) {
    await this.deleteDereferencedBlobs(writes)

    const blobPromises: Promise<void>[] = []
    for (const write of writes) {
      if (
        write.action === WriteOpAction.Create ||
        write.action === WriteOpAction.Update
      ) {
        for (const blob of write.blobs) {
          blobPromises.push(this.verifyBlobAndMakePermanent(blob))
          blobPromises.push(this.associateBlob(blob, write.uri))
        }
      }
    }
    await Promise.all(blobPromises)
  }

  async updateBlobTakedownStatus(blob: CID, takedown: StatusAttr) {
    const takedownRef = takedown.applied
      ? takedown.ref ?? new Date().toISOString()
      : null
    await this.db.db
      .updateTable('blob')
      .set({ takedownRef })
      .where('cid', '=', blob.toString())
      .executeTakeFirst()
    try {
      if (takedown.applied) {
        await this.blobstore.quarantine(blob)
      } else {
        await this.blobstore.unquarantine(blob)
      }
    } catch (err) {
      if (!(err instanceof BlobNotFoundError)) {
        throw err
      }
    }
  }

  async deleteDereferencedBlobs(writes: PreparedWrite[]) {
    const deletes = writes.filter(
      (w) => w.action === WriteOpAction.Delete,
    ) as PreparedDelete[]
    const updates = writes.filter(
      (w) => w.action === WriteOpAction.Update,
    ) as PreparedUpdate[]
    const uris = [...deletes, ...updates].map((w) => w.uri.toString())
    if (uris.length === 0) return

    const deletedRepoBlobs = await this.db.db
      .deleteFrom('record_blob')
      .where('recordUri', 'in', uris)
      .returningAll()
      .execute()
    if (deletedRepoBlobs.length < 1) return

    const deletedRepoBlobCids = deletedRepoBlobs.map((row) => row.blobCid)
    const duplicateCids = await this.db.db
      .selectFrom('record_blob')
      .where('blobCid', 'in', deletedRepoBlobCids)
      .select('blobCid')
      .execute()

    const newBlobCids = writes
      .map((w) =>
        w.action === WriteOpAction.Create || w.action === WriteOpAction.Update
          ? w.blobs
          : [],
      )
      .flat()
      .map((b) => b.cid.toString())
    const cidsToKeep = [
      ...newBlobCids,
      ...duplicateCids.map((row) => row.blobCid),
    ]
    const cidsToDelete = deletedRepoBlobCids.filter(
      (cid) => !cidsToKeep.includes(cid),
    )
    if (cidsToDelete.length < 1) return

    await this.db.db
      .deleteFrom('blob')
      .where('cid', 'in', cidsToDelete)
      .execute()
    this.db.onCommit(() => {
      this.backgroundQueue.add(async () => {
        await Promise.allSettled(
          cidsToDelete.map((cid) => this.blobstore.delete(CID.parse(cid))),
        )
      })
    })
  }

  async verifyBlobAndMakePermanent(blob: PreparedBlobRef): Promise<void> {
    const found = await this.db.db
      .selectFrom('blob')
      .selectAll()
      .where('cid', '=', blob.cid.toString())
      .where('takedownRef', 'is', null)
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

  async associateBlob(blob: PreparedBlobRef, recordUri: AtUri): Promise<void> {
    await this.db.db
      .insertInto('record_blob')
      .values({
        blobCid: blob.cid.toString(),
        recordUri: recordUri.toString(),
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

async function sha256Stream(toHash: stream.Readable): Promise<Uint8Array> {
  const hash = crypto.createHash('sha256')
  try {
    for await (const chunk of toHash) {
      hash.write(chunk)
    }
  } catch (err) {
    hash.end()
    throw err
  }
  hash.end()
  return hash.read()
}

async function mimeTypeFromStream(
  blobStream: stream.Readable,
): Promise<string | undefined> {
  const fileType = await fileTypeFromStream(blobStream)
  blobStream.destroy()
  return fileType?.mime
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

function verifyBlob(blob: PreparedBlobRef, found: BlobTable) {
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
}
