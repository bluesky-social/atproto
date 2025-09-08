import crypto from 'node:crypto'
import stream from 'node:stream'
import bytes from 'bytes'
import { fromStream as fileTypeFromStream } from 'file-type'
import { CID } from 'multiformats/cid'
import PQueue from 'p-queue'
import {
  SECOND,
  cloneStream,
  sha256RawToCid,
  streamSize,
} from '@atproto/common'
import { BlobRef } from '@atproto/lexicon'
import {
  BlobNotFoundError,
  BlobStore,
  CidMap,
  WriteOpAction,
} from '@atproto/repo'
import { AtUri } from '@atproto/syntax'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { BackgroundQueue } from '../../background'
import * as img from '../../image'
import { StatusAttr } from '../../lexicon/types/com/atproto/admin/defs'
import { blobStoreLogger as log } from '../../logger'
import { PreparedBlobRef, PreparedWrite } from '../../repo/types'
import { ActorDb, Blob as BlobTable } from '../db'
import { BlobReader } from './reader'

export type BlobMetadata = {
  tempKey: string
  size: number
  cid: CID
  mimeType: string
  width: number | null
  height: number | null
}

export class BlobTransactor extends BlobReader {
  constructor(
    public db: ActorDb,
    public blobstore: BlobStore,
    public backgroundQueue: BackgroundQueue,
  ) {
    super(db, blobstore)
  }

  async insertBlobs(recordUri: string, blobs: Iterable<BlobRef>) {
    const values = Array.from(blobs, (cid) => ({
      recordUri,
      blobCid: cid.ref.toString(),
    }))

    if (values.length) {
      await this.db.db
        .insertInto('record_blob')
        .values(values)
        .onConflict((oc) => oc.doNothing())
        .execute()
    }
  }

  async uploadBlobAndGetMetadata(
    userSuggestedMime: string,
    blobStream: stream.Readable,
  ): Promise<BlobMetadata> {
    const [tempKey, size, sha256, imgInfo, sniffedMime] = await Promise.all([
      this.blobstore.putTemp(cloneStream(blobStream)),
      streamSize(cloneStream(blobStream)),
      sha256Stream(cloneStream(blobStream)),
      img.maybeGetInfo(cloneStream(blobStream)),
      mimeTypeFromStream(cloneStream(blobStream)),
    ])

    const cid = sha256RawToCid(sha256)
    const mimeType = sniffedMime || userSuggestedMime

    return {
      tempKey,
      size,
      cid,
      mimeType,
      width: imgInfo?.width ?? null,
      height: imgInfo?.height ?? null,
    }
  }

  async trackUntetheredBlob(metadata: BlobMetadata) {
    const { tempKey, size, cid, mimeType, width, height } = metadata
    const found = await this.db.db
      .selectFrom('blob')
      .selectAll()
      .where('cid', '=', cid.toString())
      .executeTakeFirst()
    if (found?.takedownRef) {
      throw new InvalidRequestError('Blob has been takendown, cannot re-upload')
    }

    await this.db.db
      .insertInto('blob')
      .values({
        cid: cid.toString(),
        mimeType,
        size,
        tempKey,
        width,
        height,
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
    this.db.assertTransaction()

    await this.deleteDereferencedBlobs(writes)

    const blobsToMakePermanent: PreparedBlobRef[] = []

    for (const write of writes) {
      if (isCreate(write) || isUpdate(write)) {
        for (const blob of write.blobs) {
          await this.associateBlob(blob, write.uri)
          blobsToMakePermanent.push(blob)
        }
      }
    }

    await this.verifyBlobsAndMakePermanent(blobsToMakePermanent)
  }

  async updateBlobTakedownStatus(cid: CID, takedown: StatusAttr) {
    const takedownRef = takedown.applied
      ? takedown.ref ?? new Date().toISOString()
      : null
    await this.db.db
      .updateTable('blob')
      .set({ takedownRef })
      .where('cid', '=', cid.toString())
      .executeTakeFirst()

    try {
      // @NOTE find a way to not perform i/o operations during the transaction
      // (typically by using a state in the "blob" table, and another process to
      // handle the actual i/o)
      if (takedown.applied) {
        await this.blobstore.quarantine(cid)
      } else {
        await this.blobstore.unquarantine(cid)
      }
    } catch (err) {
      if (!(err instanceof BlobNotFoundError)) {
        log.error(
          { err, cid: cid.toString() },
          'could not update blob takedown status',
        )

        throw err
      }
    }
  }

  async deleteDereferencedBlobs(
    writes: PreparedWrite[],
    skipBlobStore?: boolean,
  ) {
    const deletes = writes.filter(isDelete)
    const updates = writes.filter(isUpdate)
    const uris = [...deletes, ...updates].map((w) => w.uri.toString())
    if (uris.length === 0) return

    const deletedRepoBlobs = await this.db.db
      .deleteFrom('record_blob')
      .where('recordUri', 'in', uris)
      .returning('blobCid')
      .execute()
    if (deletedRepoBlobs.length === 0) return

    const deletedRepoBlobCids = deletedRepoBlobs.map((row) => row.blobCid)
    const duplicateCids = await this.db.db
      .selectFrom('record_blob')
      .where('blobCid', 'in', deletedRepoBlobCids)
      .select('blobCid')
      .execute()

    const newBlobCids = writes
      .filter((w) => isUpdate(w) || isCreate(w))
      .flatMap((w) => w.blobs.map((b) => b.cid.toString()))

    const cidsToKeep = [
      ...newBlobCids,
      ...duplicateCids.map((row) => row.blobCid),
    ]

    const cidsToDelete = deletedRepoBlobCids.filter(
      (cid) => !cidsToKeep.includes(cid),
    )
    if (cidsToDelete.length === 0) return

    await this.db.db
      .deleteFrom('blob')
      .where('cid', 'in', cidsToDelete)
      .execute()

    if (!skipBlobStore) {
      this.db.onCommit(() => {
        this.backgroundQueue.add(async () => {
          try {
            const cids = cidsToDelete.map((cid) => CID.parse(cid))
            await this.blobstore.deleteMany(cids)
          } catch (err) {
            log.error(
              { err, cids: cidsToDelete },
              'could not delete blobs from blobstore',
            )
          }
        })
      })
    }
  }

  async verifyBlobAndMakePermanent(blob: PreparedBlobRef): Promise<void> {
    await this.verifyBlobsAndMakePermanent([blob])
  }

  private async verifyBlob(blob: PreparedBlobRef) {
    const found = await this.db.db
      .selectFrom('blob')
      .select(['tempKey', 'size', 'mimeType'])
      .where('cid', '=', blob.cid.toString())
      .where('takedownRef', 'is', null)
      .executeTakeFirst()
    if (!found) {
      throw new InvalidRequestError(
        `Could not find blob: ${blob.cid.toString()}`,
        'BlobNotFound',
      )
    }

    // If the blob was already made permanent (i.e. has no tempKey), we skip
    // verification.
    if (found.tempKey) {
      verifyBlob(blob, found)
    }

    return found
  }

  async verifyBlobsAndMakePermanent(blobs: Iterable<PreparedBlobRef>) {
    this.db.assertTransaction()

    // @NOTE We want to make sure that all blobs are verified before starting to
    // make any of them permanent. This is to avoid a situation where some blobs
    // are made permanent in storage when the transaction failed (e.g. due to
    // another blob being invalid). For that purpose, we create a list of all
    // (verified) blobs candidates before actually making any of them permanent.

    const blobsToMakePermanent = new CidMap<string>()

    for (const blob of blobs) {
      if (blobsToMakePermanent.has(blob.cid)) continue

      const { tempKey } = await this.verifyBlob(blob)
      if (tempKey) blobsToMakePermanent.set(blob.cid, tempKey)
    }

    // If any upload task fails (e.g. due to a timeout), we might still end-up
    // in a situation where some blobs are getting orphaned. This can be fixed
    // by moving the code that makes blobs permanent out of the transaction
    // (e.g. in the background queue). This is fine for now since this can't be
    // triggered by a user (only by failing uploads, which is a server issue).

    // @NOTE it is less than ideal to perform i/o operations during a
    // transaction. Especially since there have been instances of the actor-db
    // being locked, requiring to kick the processes. A better solution would be
    // to update the blob state in the database (e.g. "makeItPermanent") and to
    // process those updates outside of the current transaction.
    const updatedCids = await this.makeBlobsPermanent(blobsToMakePermanent)

    await this.db.db
      .updateTable('blob')
      .set({ tempKey: null })
      .where('cid', 'in', updatedCids.map(String))
      .execute()
  }

  /**
   * Concurrently make blobs permanent in the BlobStore. If any of the task
   * fails, all other tasks are aborted. Blobs are **not** removed from the
   * permanent storage if a task fails (or the transaction is rolled back). This
   * could result in orphaned blobs (which, currently, would need to be cleaned
   * up manually).
   *
   * @returns The list of CIDs that were made permanent.
   */
  private async makeBlobsPermanent(it: Iterable<[cid: CID, tempKey: string]>) {
    const ac = new AbortController()

    const tasks = Array.from(it, ([cid, tempKey]) => async () => {
      ac.signal.throwIfAborted()

      try {
        await this.blobstore.makePermanent(tempKey, cid)

        return cid
      } catch (err) {
        log.error(
          { err, tempKey, cid: cid.toString() },
          'could not make blob permanent',
        )

        throw err
      }
    })

    // Limit the number of parallel requests made to the BlobStore by using a
    // queue with concurrency management.
    const queue = new PQueue({
      concurrency: 20,
      // The blob store should already limit the time of every operation. We
      // add a timeout here as an extra precaution.
      timeout: 60 * SECOND,
      throwOnTimeout: true,
    })

    // This will basically behave like `Promise.all` (throwing as soon as any
    // task fails) but with a limited number of tasks running in parallel.
    return queue.addAll(tasks).finally(() => {
      // If a task fails (either because of a timeout or an error), we abort all
      // other tasks that are still running by aborting the shared signal.
      queue.clear()
    })
  }

  async insertBlobMetadata(blob: PreparedBlobRef): Promise<void> {
    await this.db.db
      .insertInto('blob')
      .values({
        cid: blob.cid.toString(),
        mimeType: blob.mimeType,
        size: blob.size,
        createdAt: new Date().toISOString(),
      })
      .onConflict((oc) => oc.doNothing())
      .execute()
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

function verifyBlob(
  blob: PreparedBlobRef,
  found: Pick<BlobTable, 'size' | 'mimeType'>,
) {
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

function isCreate(write: PreparedWrite) {
  return write.action === WriteOpAction.Create
}
function isUpdate(write: PreparedWrite) {
  return write.action === WriteOpAction.Update
}
function isDelete(write: PreparedWrite) {
  return write.action === WriteOpAction.Delete
}
