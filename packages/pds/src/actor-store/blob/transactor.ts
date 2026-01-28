import crypto from 'node:crypto'
import stream from 'node:stream'
import { fromStream as fileTypeFromStream } from 'file-type'
import PQueue from 'p-queue'
import { SECOND, cloneStream, streamSize } from '@atproto/common'
import { BlobRef, Cid, cidForRawHash, parseCid } from '@atproto/lex-data'
import { BlobNotFoundError, BlobStore, WriteOpAction } from '@atproto/repo'
import { AtUri } from '@atproto/syntax'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { BackgroundQueue } from '../../background'
import { com } from '../../lexicons/index.js'
import { blobStoreLogger as log } from '../../logger'
import { PreparedWrite } from '../../repo/types'
import { ActorDb, Blob as BlobTable } from '../db'
import { BlobReader } from './reader'

export type BlobMetadata = {
  tempKey: string
  size: number
  cid: Cid
  mimeType: string
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
    const [tempKey, size, sha256, sniffedMime] = await Promise.all([
      this.blobstore.putTemp(cloneStream(blobStream)),
      streamSize(cloneStream(blobStream)),
      sha256Stream(cloneStream(blobStream)),
      mimeTypeFromStream(cloneStream(blobStream)),
    ])

    return {
      tempKey,
      size,
      cid: cidForRawHash(sha256),
      mimeType: sniffedMime || userSuggestedMime,
    }
  }

  async trackUntetheredBlob(metadata: BlobMetadata): Promise<BlobRef> {
    const { tempKey, size, cid, mimeType } = metadata
    const cidStr = cid.toString()

    const found = await this.db.db
      .selectFrom('blob')
      .selectAll()
      .where('cid', '=', cidStr)
      .executeTakeFirst()
    if (found?.takedownRef) {
      throw new InvalidRequestError('Blob has been takendown, cannot re-upload')
    }

    await this.db.db
      .insertInto('blob')
      .values({
        cid: cidStr,
        mimeType,
        size,
        tempKey,
        createdAt: new Date().toISOString(),
      })
      .onConflict((oc) =>
        oc
          .column('cid')
          .doUpdateSet({ tempKey })
          .where('blob.tempKey', 'is not', null),
      )
      .execute()

    return {
      $type: 'blob',
      ref: cid,
      mimeType,
      size,
    }
  }

  async processWriteBlobs(rev: string, writes: PreparedWrite[]) {
    await this.deleteDereferencedBlobs(writes)

    const ac = new AbortController()

    // Limit the number of parallel requests made to the BlobStore by using a
    // a queue with concurrency management.
    type Task = () => Promise<void>
    const tasks: Task[] = []

    for (const write of writes) {
      if (isCreate(write) || isUpdate(write)) {
        for (const blob of write.blobs) {
          tasks.push(async () => {
            if (ac.signal.aborted) return
            await this.associateBlob(blob, write.uri)
            await this.verifyBlobAndMakePermanent(blob, ac.signal)
          })
        }
      }
    }

    try {
      const queue = new PQueue({
        concurrency: 20,
        // The blob store should already limit the time of every operation. We
        // add a timeout here as an extra precaution.
        timeout: 60 * SECOND,
        throwOnTimeout: true,
      })

      // Will reject as soon as any task fails, causing the "finally" block
      // below to run, aborting every other pending tasks.
      await queue.addAll(tasks)
    } finally {
      ac.abort()
    }
  }

  async updateBlobTakedownStatus(
    cid: Cid,
    takedown: com.atproto.admin.defs.StatusAttr,
  ) {
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
      .flatMap((w) => w.blobs.map((b) => b.ref.toString()))

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
            const cids = cidsToDelete.map((cid) => parseCid(cid))
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

  async verifyBlobAndMakePermanent(
    blob: BlobRef,
    signal?: AbortSignal,
  ): Promise<void> {
    const found = await this.db.db
      .selectFrom('blob')
      .select(['tempKey', 'size', 'mimeType'])
      .where('cid', '=', blob.ref.toString())
      .where('takedownRef', 'is', null)
      .executeTakeFirst()

    signal?.throwIfAborted()

    if (!found) {
      throw new InvalidRequestError(
        `Could not find blob: ${blob.ref.toString()}`,
        'BlobNotFound',
      )
    }

    if (found.tempKey) {
      verifyBlob(blob, found)

      // @NOTE it is less than ideal to perform async (i/o) operations during a
      // transaction. Especially since there have been instances of the actor-db
      // being locked, requiring to kick the processes.

      // The better solution would be to update the blob state in the database
      // (e.g. "makeItPermanent") and to process those updates outside of the
      // transaction.

      await this.blobstore
        .makePermanent(found.tempKey, blob.ref)
        .catch((err) => {
          log.error(
            { err, cid: blob.ref.toString() },
            'could not make blob permanent',
          )

          throw err
        })

      signal?.throwIfAborted()

      await this.db.db
        .updateTable('blob')
        .set({ tempKey: null })
        .where('tempKey', '=', found.tempKey)
        .execute()
    }
  }

  async insertBlobMetadata(blob: BlobRef): Promise<void> {
    await this.db.db
      .insertInto('blob')
      .values({
        cid: blob.ref.toString(),
        mimeType: blob.mimeType,
        size: blob.size,
        createdAt: new Date().toISOString(),
      })
      .onConflict((oc) => oc.doNothing())
      .execute()
  }

  async associateBlob(blob: BlobRef, recordUri: AtUri): Promise<void> {
    await this.db.db
      .insertInto('record_blob')
      .values({
        blobCid: blob.ref.toString(),
        recordUri: recordUri.toString(),
      })
      .onConflict((oc) => oc.doNothing())
      .execute()
  }
}

export class CidNotFound extends Error {
  cid: Cid
  constructor(cid: Cid) {
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

/**
 * Ensures that the blob referenced in the record matches the stored blob.
 */
function verifyBlob(
  blob: BlobRef,
  found: Pick<BlobTable, 'size' | 'mimeType'>,
) {
  if (blob.mimeType !== found.mimeType) {
    throw new InvalidRequestError(
      `Referenced Mimetype does not match stored blob. Expected: ${found.mimeType}, Got: ${blob.mimeType}`,
      'InvalidMimeType',
    )
  }

  if (blob.size !== found.size) {
    throw new InvalidRequestError(
      `Referenced Size does not match stored blob. Expected: ${found.size}, Got: ${blob.size}`,
      'InvalidSize',
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
