import { Readable } from 'stream'
import assert from 'assert'
import PQueue from 'p-queue'
import axios from 'axios'
import { CID } from 'multiformats/cid'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { AsyncBuffer, TID, wait } from '@atproto/common'
import { AtUri } from '@atproto/syntax'
import {
  Repo,
  WriteOpAction,
  getAndParseRecord,
  readCarStream,
  verifyDiff,
} from '@atproto/repo'
import { BlobRef, LexValue, RepoRecord } from '@atproto/lexicon'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { ActorStoreTransactor } from '../../../../actor-store'
import { AtprotoData } from '@atproto/identity'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.temp.importRepo({
    opts: {
      blobLimit: 5 * 1024 * 1024 * 1024, // 5GB
    },
    auth: ctx.authVerifier.role,
    handler: async ({ params, input, req }) => {
      const { did } = params
      const outBuffer = new AsyncBuffer<string>()
      sendTicks(outBuffer).catch((err) => {
        req.log.error({ err }, 'failed to send ticks')
      })
      processImport(ctx, did, input.body, outBuffer).catch(async (err) => {
        req.log.error({ did, err }, 'failed import')
        try {
          await ctx.actorStore.destroy(did)
        } catch (err) {
          req.log.error({ did, err }, 'failed to clean up actor store')
        }
        outBuffer.throw(err)
      })

      return {
        encoding: 'text/plain',
        body: Readable.from(outBuffer.events()),
      }
    },
  })
}

const sendTicks = async (outBuffer: AsyncBuffer<string>) => {
  while (!outBuffer.isClosed) {
    outBuffer.push('tick\n')
    await wait(1000)
  }
}

const processImport = async (
  ctx: AppContext,
  did: string,
  incomingCar: AsyncIterable<Uint8Array>,
  outBuffer: AsyncBuffer<string>,
) => {
  const didData = await ctx.idResolver.did.resolveAtprotoData(did)
  const alreadyExists = await ctx.actorStore.exists(did)
  if (!alreadyExists) {
    const keypair = await ctx.actorStore.getReservedKeypair(did)
    if (!keypair) {
      throw new InvalidRequestError('No signing key reserved')
    }
    await ctx.actorStore.create(did, keypair)
  }
  await ctx.actorStore.transact(did, async (actorStore) => {
    const blobRefs = await importRepo(actorStore, incomingCar, outBuffer)
    await importBlobs(actorStore, didData, blobRefs, outBuffer)
  })
  outBuffer.close()
}

const importRepo = async (
  actorStore: ActorStoreTransactor,
  incomingCar: AsyncIterable<Uint8Array>,
  outBuffer: AsyncBuffer<string>,
) => {
  const now = new Date().toISOString()
  const rev = TID.nextStr()
  const did = actorStore.repo.did

  const { roots, blocks } = await readCarStream(incomingCar)
  if (roots.length !== 1) {
    throw new InvalidRequestError('expected one root')
  }
  outBuffer.push(`read ${blocks.size} blocks\n`)
  const currRoot = await actorStore.db.db
    .selectFrom('repo_root')
    .selectAll()
    .executeTakeFirst()
  const currRepo = currRoot
    ? await Repo.load(actorStore.repo.storage, CID.parse(currRoot.cid))
    : null
  const diff = await verifyDiff(
    currRepo,
    blocks,
    roots[0],
    undefined,
    undefined,
    { ensureLeaves: false },
  )
  outBuffer.push(`diffed repo and found ${diff.writes.length} writes\n`)
  diff.commit.rev = rev
  await actorStore.repo.storage.applyCommit(diff.commit, currRepo === null)
  const recordQueue = new PQueue({ concurrency: 50 })
  let blobRefs: BlobRef[] = []
  let count = 0
  for (const write of diff.writes) {
    recordQueue.add(async () => {
      const uri = AtUri.make(did, write.collection, write.rkey)
      if (write.action === WriteOpAction.Delete) {
        await actorStore.record.deleteRecord(uri)
      } else {
        let parsedRecord: RepoRecord | null
        try {
          const parsed = await getAndParseRecord(blocks, write.cid)
          parsedRecord = parsed.record
        } catch {
          parsedRecord = null
        }
        const indexRecord = actorStore.record.indexRecord(
          uri,
          write.cid,
          parsedRecord,
          write.action,
          rev,
          now,
        )
        const recordBlobs = findBlobRefs(parsedRecord)
        blobRefs = blobRefs.concat(recordBlobs)
        const blobValues = recordBlobs.map((cid) => ({
          recordUri: uri.toString(),
          blobCid: cid.ref.toString(),
        }))
        const indexRecordBlobs =
          blobValues.length > 0
            ? actorStore.db.db
                .insertInto('record_blob')
                .values(blobValues)
                .onConflict((oc) => oc.doNothing())
                .execute()
            : Promise.resolve()
        await Promise.all([indexRecord, indexRecordBlobs])
      }
      count++
      if (count % 50 === 0) {
        outBuffer.push(`indexed ${count}/${diff.writes.length} writes\n`)
      }
    })
  }
  outBuffer.push(`indexed ${count}/${diff.writes.length} writes\n`)
  await recordQueue.onIdle()
  return blobRefs
}

const importBlobs = async (
  actorStore: ActorStoreTransactor,
  didData: AtprotoData,
  blobRefs: BlobRef[],
  outBuffer: AsyncBuffer<string>,
) => {
  let blobCount = 0
  const blobQueue = new PQueue({ concurrency: 10 })
  outBuffer.push(`fetching ${blobRefs.length} blobs\n`)
  const endpoint = `${didData.pds}/xrpc/com.atproto.sync.getBlob`
  for (const ref of blobRefs) {
    blobQueue.add(async () => {
      try {
        await importBlob(actorStore, endpoint, ref)
        blobCount++
        outBuffer.push(`imported ${blobCount}/${blobRefs.length} blobs\n`)
      } catch (err) {
        outBuffer.push(`failed to import blob: ${ref.ref.toString()}\n`)
      }
    })
  }
  await blobQueue.onIdle()
  outBuffer.push(`finished importing all blobs\n`)
}

const importBlob = async (
  actorStore: ActorStoreTransactor,
  endpoint: string,
  blob: BlobRef,
) => {
  const hasBlob = await actorStore.db.db
    .selectFrom('blob')
    .selectAll()
    .where('cid', '=', blob.ref.toString())
    .executeTakeFirst()
  if (hasBlob) {
    return
  }
  const res = await axios.get(endpoint, {
    params: { did: actorStore.repo.did, cid: blob.ref.toString() },
    decompress: true,
    responseType: 'stream',
    timeout: 5000,
  })
  const mimeType = res.headers['content-type'] ?? 'application/octet-stream'
  const importedRef = await actorStore.repo.blob.addUntetheredBlob(
    mimeType,
    res.data,
  )
  assert(blob.ref.equals(importedRef.ref))
  await actorStore.repo.blob.verifyBlobAndMakePermanent({
    mimeType: blob.mimeType,
    cid: blob.ref,
    constraints: {},
  })
}

export const findBlobRefs = (val: LexValue, layer = 0): BlobRef[] => {
  if (layer > 10) {
    return []
  }
  // walk arrays
  if (Array.isArray(val)) {
    return val.flatMap((item) => findBlobRefs(item, layer + 1))
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
    return Object.values(val).flatMap((item) => findBlobRefs(item, layer + 1))
  }
  // pass through
  return []
}
