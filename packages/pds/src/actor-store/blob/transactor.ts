import assert from 'node:assert'
import type stream from 'node:stream'
import {
  type Duplex,
  PassThrough,
  type TransformCallback,
  pipeline,
} from 'node:stream'
import {
  type FileTypeOptions,
  FileTypeParser,
  type FileTypeResult,
} from 'file-type'
import PQueue from 'p-queue'
import { fromStream } from 'strtok3'
import { HashPassThrough, MaxSizeChecker, SECOND, Tee } from '@atproto/common'
import {
  type BlobRef,
  type Cid,
  type TypedBlobRef,
  cidForRawHash,
  getBlobCidString,
  parseCid,
} from '@atproto/lex-data'
import { BlobNotFoundError, type BlobStore, WriteOpAction } from '@atproto/repo'
import { type AtUri, currentDatetimeString } from '@atproto/syntax'
import { InvalidRequestError } from '@atproto/xrpc-server'
import type { BackgroundQueue } from '../../background.js'
import type { com } from '../../lexicons/index.js'
import { blobStoreLogger as log } from '../../logger.js'
import type { PreparedWrite } from '../../repo/types.js'
import type { ActorDb, Blob as BlobTable } from '../db/index.js'
import { BlobReader } from './reader.js'

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
    const values = Array.from(blobs, (blob) => ({
      recordUri,
      blobCid: getBlobCidString(blob),
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
    blobStream: stream.Readable,
    fallbackMime: `${string}/${string}` = 'application/octet-stream',
    maxSize = Infinity,
  ): Promise<BlobMetadata> {
    try {
      const hashDuplex = new HashPassThrough('sha256')
      const sizeDuplex = new MaxSizeChecker(maxSize)
      const typeDuplex = new FileTypePassThrough()

      // @NOTE a pipeline of duplex streams is used to ensure that backpressure
      // is properly propagated to the input stream. using inputStream.pipe()
      // with several destinations does **not** propagate backpressure, and
      // **will** high memory consumption (hash and size duplexes consume the
      // stream faster than the blobstore can process it).
      const streams = [blobStream, hashDuplex, sizeDuplex, typeDuplex]

      const blobStoreStream = pipeline(streams, (_err) => {
        // errors will be propagated to the streams, and handled (rethrown) by
        // the blobStore.
      }) as Duplex // pipeline() returns the last stream

      // Start the pipeline by reading its output
      const tempKey = await this.blobstore.putTemp(blobStoreStream)

      // Fool-proof against faulty blobstore implementations
      assert(
        streams.every((s) => s.readableEnded),
        'blobstore did not fully consume the stream',
      )

      return {
        tempKey,
        size: sizeDuplex.totalSize,
        cid: cidForRawHash(hashDuplex.digest),
        mimeType: typeDuplex.fileTypeResult?.mime || fallbackMime,
      }
    } finally {
      blobStream.destroy()
    }
  }

  async trackUntetheredBlob(metadata: BlobMetadata): Promise<TypedBlobRef> {
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
        createdAt: currentDatetimeString(),
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
      ? (takedown.ref ?? currentDatetimeString())
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
    blob: TypedBlobRef,
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

  async insertBlobMetadata(blob: TypedBlobRef): Promise<void> {
    await this.db.db
      .insertInto('blob')
      .values({
        cid: blob.ref.toString(),
        mimeType: blob.mimeType,
        size: blob.size,
        createdAt: currentDatetimeString(),
      })
      .onConflict((oc) => oc.doNothing())
      .execute()
  }

  async associateBlob(blob: TypedBlobRef, recordUri: AtUri): Promise<void> {
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

// "file-type" does not provide a duplex implementation so we create one here
class FileTypePassThrough extends Tee {
  readonly fileTypePromise: Promise<FileTypeResult | undefined>

  #fileTypeResult?: PromiseSettledResult<FileTypeResult | undefined>
  get fileTypeResult(): FileTypeResult | undefined {
    const result = this.#fileTypeResult
    if (result) return result.status === 'fulfilled' ? result.value : undefined
    throw new Error('FileTypePassThrough result is not yet available')
  }

  constructor(options?: FileTypeOptions) {
    const branch = new PassThrough()
    super(branch)

    const parser = new FileTypeParser(options)

    // @NOTE file-type does not support NodeJS Readable and recommends wrapping
    // into a web steam. We use strtok3 to convert the NodeJS Readable into a
    // tokenizer, bypassing that limitation.
    this.fileTypePromise = fromStream(branch)
      .then((tokenizer) => parser.fromTokenizer(tokenizer))
      // file-type won't destroy() the stream. We need to destroy to allow
      // the Tee's main stream to flow freely.
      .finally(() => branch.destroy())

    // avoids unhandled rejections (might be awaited later)
    this.fileTypePromise.then(
      (value) => {
        this.#fileTypeResult = { status: 'fulfilled', value }
      },
      (reason) => {
        this.#fileTypeResult = { status: 'rejected', reason }
      },
    )
  }

  _final(cb: TransformCallback) {
    // propagate the result promise to the final callback, so that the stream is
    // not considered finished until the file type has been determined.
    super._final((err) => {
      this.fileTypePromise.then(
        () => cb(err),
        () => cb(err),
      )
    })
  }

  _destroy(err: Error | null, cb: (err?: Error | null) => void) {
    // propagate the result promise to the destroy callback, so that the stream
    // is not considered finished until the file type has been determined.
    super._destroy(err, (err) => {
      this.fileTypePromise.then(
        () => cb(err),
        () => cb(err),
      )
    })
  }
}

/**
 * Ensures that the blob referenced in the record matches the stored blob.
 */
function verifyBlob(
  blob: TypedBlobRef,
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
