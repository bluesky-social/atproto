import stream from 'stream'
import crypto from 'crypto'
import { CID } from 'multiformats/cid'
import bytes from 'bytes'
import { fromStream as fileTypeFromStream } from 'file-type'
import { BlobStore, CidSet, WriteOpAction } from '@atproto/repo'
import { AtUri } from '@atproto/syntax'
import { cloneStream, sha256RawToCid, streamSize } from '@atproto/common'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { PreparedBlobRef, PreparedWrite } from '../../repo/types'
import Database from '../../db'
import { Blob as BlobTable } from '../../db/tables/blob'
import * as img from '../../image'
import { BlobRef } from '@atproto/lexicon'
import { PreparedDelete, PreparedUpdate } from '../../repo'
import { BackgroundQueue } from '../../background'

export class RepoBlobs {
  constructor(
    public db: Database,
    public blobstore: BlobStore,
    public backgroundQueue: BackgroundQueue,
  ) {}

  async addUntetheredBlob(
    creator: string,
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
        creator,
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
          .columns(['creator', 'cid'])
          .doUpdateSet({ tempKey })
          .where('blob.tempKey', 'is not', null),
      )
      .execute()
    return new BlobRef(cid, mimeType, size)
  }

  async processWriteBlobs(did: string, rev: string, writes: PreparedWrite[]) {
    await this.deleteDereferencedBlobs(did, writes)

    const blobPromises: Promise<void>[] = []
    for (const write of writes) {
      if (
        write.action === WriteOpAction.Create ||
        write.action === WriteOpAction.Update
      ) {
        for (const blob of write.blobs) {
          blobPromises.push(this.verifyBlobAndMakePermanent(did, blob))
          blobPromises.push(this.associateBlob(blob, write.uri, rev, did))
        }
      }
    }
    await Promise.all(blobPromises)
  }

  async deleteDereferencedBlobs(did: string, writes: PreparedWrite[]) {
    const deletes = writes.filter(
      (w) => w.action === WriteOpAction.Delete,
    ) as PreparedDelete[]
    const updates = writes.filter(
      (w) => w.action === WriteOpAction.Update,
    ) as PreparedUpdate[]
    const uris = [...deletes, ...updates].map((w) => w.uri.toString())
    if (uris.length === 0) return

    const deletedRepoBlobs = await this.db.db
      .deleteFrom('repo_blob')
      .where('did', '=', did)
      .where('recordUri', 'in', uris)
      .returningAll()
      .execute()
    if (deletedRepoBlobs.length < 1) return

    const deletedRepoBlobCids = deletedRepoBlobs.map((row) => row.cid)
    const duplicateCids = await this.db.db
      .selectFrom('repo_blob')
      .where('did', '=', did)
      .where('cid', 'in', deletedRepoBlobCids)
      .select('cid')
      .execute()

    const newBlobCids = writes
      .map((w) =>
        w.action === WriteOpAction.Create || w.action === WriteOpAction.Update
          ? w.blobs
          : [],
      )
      .flat()
      .map((b) => b.cid.toString())
    const cidsToKeep = [...newBlobCids, ...duplicateCids.map((row) => row.cid)]
    const cidsToDelete = deletedRepoBlobCids.filter(
      (cid) => !cidsToKeep.includes(cid),
    )
    if (cidsToDelete.length < 1) return

    await this.db.db
      .deleteFrom('blob')
      .where('creator', '=', did)
      .where('cid', 'in', cidsToDelete)
      .execute()

    // check if these blobs are used by other users before deleting from blobstore
    const stillUsedRes = await this.db.db
      .selectFrom('blob')
      .where('cid', 'in', cidsToDelete)
      .select('cid')
      .distinct()
      .execute()
    const stillUsed = stillUsedRes.map((row) => row.cid)

    const blobsToDelete = cidsToDelete.filter((cid) => !stillUsed.includes(cid))

    // move actual blob deletion to the background queue
    if (blobsToDelete.length > 0) {
      this.db.onCommit(() => {
        this.backgroundQueue.add(async () => {
          await Promise.allSettled(
            blobsToDelete.map((cid) => this.blobstore.delete(CID.parse(cid))),
          )
        })
      })
    }
  }

  async verifyBlobAndMakePermanent(
    creator: string,
    blob: PreparedBlobRef,
  ): Promise<void> {
    const { ref } = this.db.db.dynamic
    const found = await this.db.db
      .selectFrom('blob')
      .selectAll()
      .where('creator', '=', creator)
      .where('cid', '=', blob.cid.toString())
      .whereNotExists(
        // Check if blob has been taken down
        this.db.db
          .selectFrom('repo_blob')
          .selectAll()
          .where('takedownId', 'is not', null)
          .whereRef('cid', '=', ref('blob.cid')),
      )
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
    blob: PreparedBlobRef,
    recordUri: AtUri,
    repoRev: string,
    did: string,
  ): Promise<void> {
    await this.db.db
      .insertInto('repo_blob')
      .values({
        cid: blob.cid.toString(),
        recordUri: recordUri.toString(),
        repoRev,
        did,
      })
      .onConflict((oc) => oc.doNothing())
      .execute()
  }

  async listSinceRev(did: string, rev?: string): Promise<CID[]> {
    let builder = this.db.db
      .selectFrom('repo_blob')
      .where('did', '=', did)
      .select('cid')
    if (rev) {
      builder = builder.where('repoRev', '>', rev)
    }
    const res = await builder.execute()
    const cids = res.map((row) => CID.parse(row.cid))
    return new CidSet(cids).toList()
  }

  async deleteForUser(did: string): Promise<void> {
    // Not done in transaction because it would be too long, prone to contention.
    // Also, this can safely be run multiple times if it fails.
    const deleted = await this.db.db
      .deleteFrom('blob')
      .where('creator', '=', did)
      .returningAll()
      .execute()
    await this.db.db.deleteFrom('repo_blob').where('did', '=', did).execute()
    const deletedCids = deleted.map((d) => d.cid)
    let duplicateCids: string[] = []
    if (deletedCids.length > 0) {
      const res = await this.db.db
        .selectFrom('repo_blob')
        .where('cid', 'in', deletedCids)
        .selectAll()
        .execute()
      duplicateCids = res.map((d) => d.cid)
    }
    const toDelete = deletedCids.filter((cid) => !duplicateCids.includes(cid))
    if (toDelete.length > 0) {
      await Promise.all(
        toDelete.map((cid) => this.blobstore.delete(CID.parse(cid))),
      )
    }
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
