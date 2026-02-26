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
import { BlobNotFoundError, BlobStore, WriteOpAction } from '@atproto/repo'
import { AtUri } from '@atproto/syntax'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { BackgroundQueue } from '../../background'
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

    const cid = sha256RawToCid(sha256)
    const mimeType = sniffedMime || userSuggestedMime

    return {
      tempKey,
      size,
      cid,
      mimeType,
    }
  }

  async trackUntetheredBlob(metadata: BlobMetadata) {
    const { tempKey, size, cid, mimeType } = metadata
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

  async verifyBlobAndMakePermanent(
    blob: PreparedBlobRef,
    signal?: AbortSignal,
  ): Promise<void> {
    const found = await this.db.db
      .selectFrom('blob')
      .select(['tempKey', 'size', 'mimeType'])
      .where('cid', '=', blob.cid.toString())
      .where('takedownRef', 'is', null)
      .executeTakeFirst()

    signal?.throwIfAborted()

    if (!found) {
      throw new InvalidRequestError(
        `Could not find blob: ${blob.cid.toString()}`,
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
        .makePermanent(found.tempKey, blob.cid)
        .catch((err) => {
          log.error(
            { err, cid: blob.cid.toString() },
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
