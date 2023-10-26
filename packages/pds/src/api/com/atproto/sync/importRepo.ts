import { Readable } from 'stream'
import assert from 'assert'
import PQueue from 'p-queue'
import axios from 'axios'
import { CID } from 'multiformats/cid'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { AsyncBuffer, TID } from '@atproto/common'
import { AtUri } from '@atproto/syntax'
import { Secp256k1Keypair } from '@atproto/crypto'
import {
  BlockMap,
  Repo,
  WriteOpAction,
  readCarStream,
  verifyIncomingCarBlocks,
} from '@atproto/repo'
import { BlobRef, LexValue } from '@atproto/lexicon'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { SqlRepoTransactor } from '../../../../actor-store/repo/sql-repo-transactor'
import { RecordTransactor } from '../../../../actor-store/record/transactor'
import { BlobTransactor } from '../../../../actor-store/blob/transactor'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.sync.importRepo({
    handler: async ({ params, input }) => {
      const { did } = params
      const car = await readCarStream(input.body)
      const roots = await car.getRoots()
      if (roots.length !== 1) {
        throw new InvalidRequestError('expected one root')
      }
      const prevCommitCid = roots[0]

      const keypair = await Secp256k1Keypair.create({ exportable: true })
      await ctx.actorStore.create(did, keypair, async () => {})
      const db = await ctx.actorStore.db(did)
      const now = new Date().toISOString()
      const repoTransactor = new SqlRepoTransactor(db, now)

      const rev = TID.nextStr()
      let blocks = new BlockMap()
      let count = 0
      let prevPromise = Promise.resolve()
      for await (const block of verifyIncomingCarBlocks(car.blocks())) {
        blocks.set(block.cid, block.bytes)
        count++
        if (count >= 100) {
          await prevPromise
          prevPromise = repoTransactor.putMany(blocks, rev)
          blocks = new BlockMap()
          count = 0
        }
      }
      await prevPromise
      await repoTransactor.putMany(blocks, rev)

      let repo = await Repo.load(repoTransactor, prevCommitCid)
      repo = await repo.resignCommit(rev, keypair)

      const outBuffer = new AsyncBuffer<string>()
      processRepo(ctx, outBuffer, repo, now)

      return {
        encoding: 'text/plain',
        body: Readable.from(outBuffer.events()),
      }
    },
  })
}

const processRepo = async (
  ctx: AppContext,
  outBuffer: AsyncBuffer<string>,
  repo: Repo,
  now: string,
) => {
  outBuffer.push('finished reading car')
  const did = repo.did
  const db = await ctx.actorStore.db(did)
  const recordTransactor = new RecordTransactor(db, ctx.blobstore(did))

  const recordQueue = new PQueue({ concurrency: 50 })
  let blobRefs: BlobRef[] = []
  let count = 0
  for await (const entry of repo.walkRecords()) {
    const uri = AtUri.make(did, entry.collection, entry.rkey)
    recordQueue.add(async () => {
      const recordBlobs = findBlobRefs(entry.record)
      const indexRecord = recordTransactor.indexRecord(
        uri,
        entry.cid,
        entry.record,
        WriteOpAction.Create,
        repo.commit.rev,
        now,
      )
      const blobValues = recordBlobs.map((cid) => ({
        recordUri: uri.toString(),
        blobCid: cid.toString(),
      }))
      const indexRecordBlobs =
        blobValues.length > 0
          ? db.db.insertInto('record_blob').values(blobValues).execute()
          : Promise.resolve()
      blobRefs = blobRefs.concat(recordBlobs)
      await Promise.all([indexRecord, indexRecordBlobs])
      count++
      if (count % 50 === 0) {
        outBuffer.push(`indexed ${count} records`)
      }
    })
  }
  await recordQueue.onIdle()
  outBuffer.push(`importing ${blobRefs.length} blobs`)

  const blobstore = ctx.blobstore(did)
  const blobTransactor = new BlobTransactor(db, blobstore, ctx.backgroundQueue)
  const didData = await ctx.idResolver.did.resolveAtprotoData(did)
  let blobCount = 0
  const blobQueue = new PQueue({ concurrency: 10 })
  for (const ref of blobRefs) {
    blobQueue.add(async () => {
      const res = await axios.get(
        `${didData.pds}/xrpc/com.atproto.sync.getBlob`,
        {
          params: { did, cid: ref.ref.toString() },
          decompress: true,
          responseType: 'stream',
          timeout: 5000,
        },
      )
      const mimeType = res.headers['content-type'] ?? 'application/octet-stream'
      const importedRef = await blobTransactor.addUntetheredBlob(
        mimeType,
        res.data,
      )
      assert(ref.ref.equals(importedRef.ref))
      blobTransactor.verifyBlobAndMakePermanent({
        mimeType: ref.mimeType,
        cid: ref.ref,
        constraints: {},
      })
      blobCount++
      outBuffer.push(`imported ${blobCount}/${blobRefs.length} blobs`)
    })
  }
  await blobQueue.onIdle()
  outBuffer.push(`finished importing all blobs`)
}

const findBlobRefs = (val: LexValue): BlobRef[] => {
  // walk arrays
  if (Array.isArray(val)) {
    return val.flatMap((item) => findBlobRefs(item))
  }
  // objects
  if (val && typeof val === 'object') {
    // convert blobs, leaving the original encoding so that we don't change CIDs on re-encode
    if (val instanceof BlobRef) {
      return [val]
    }
    // retain cids & bytes
    if (CID.asCID(val) || val instanceof Uint8Array) {
      return []
    }
    return Object.values(val).flatMap((item) => findBlobRefs(item))
  }
  // pass through
  return []
}
