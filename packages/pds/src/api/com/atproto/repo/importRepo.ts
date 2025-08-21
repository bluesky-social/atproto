import { CID } from 'multiformats/cid'
import PQueue from 'p-queue'
import { TID } from '@atproto/common'
import { BlobRef, LexValue, RepoRecord } from '@atproto/lexicon'
import {
  BlockMap,
  WriteOpAction,
  getAndParseRecord,
  readCarStream,
  verifyDiff,
} from '@atproto/repo'
import { AtUri } from '@atproto/syntax'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { ActorStoreTransactor } from '../../../../actor-store/actor-store-transactor'
import { ACCESS_FULL } from '../../../../auth-scope'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.repo.importRepo({
    auth: ctx.authVerifier.authorization({
      checkTakedown: true,
      scopes: ACCESS_FULL,
      authorize: (permissions) => {
        permissions.assertAccount({ attr: 'repo', action: 'manage' })
      },
    }),
    handler: async ({ input, auth }) => {
      if (!ctx.cfg.service.acceptingImports) {
        throw new InvalidRequestError('Service is not accepting repo imports')
      }

      const { did } = auth.credentials

      await ctx.actorStore.transact(did, (store) =>
        importRepo(store, input.body),
      )
    },
  })
}

const importRepo = async (
  actorStore: ActorStoreTransactor,
  incomingCar: AsyncIterable<Uint8Array>,
) => {
  const now = new Date().toISOString()
  const rev = TID.nextStr()
  const did = actorStore.repo.did

  const { roots, blocks } = await readCarStream(incomingCar)
  if (roots.length !== 1) {
    await blocks.dump()
    throw new InvalidRequestError('expected one root')
  }
  const blockMap = new BlockMap()
  for await (const block of blocks) {
    blockMap.set(block.cid, block.bytes)
  }
  const currRepo = await actorStore.repo.maybeLoadRepo()
  const diff = await verifyDiff(
    currRepo,
    blockMap,
    roots[0],
    undefined,
    undefined,
    { ensureLeaves: false },
  )
  diff.commit.rev = rev
  await actorStore.repo.storage.applyCommit(diff.commit, currRepo === null)
  const recordQueue = new PQueue({ concurrency: 50 })
  const controller = new AbortController()
  for (const write of diff.writes) {
    recordQueue
      .add(
        async () => {
          const uri = AtUri.make(did, write.collection, write.rkey)
          if (write.action === WriteOpAction.Delete) {
            await actorStore.record.deleteRecord(uri)
          } else {
            let parsedRecord: RepoRecord
            try {
              const parsed = await getAndParseRecord(blockMap, write.cid)
              parsedRecord = parsed.record
            } catch {
              throw new InvalidRequestError(
                `Could not parse record at '${write.collection}/${write.rkey}'`,
              )
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
            const indexRecordBlobs = actorStore.repo.blob.insertBlobs(
              uri.toString(),
              recordBlobs,
            )
            await Promise.all([indexRecord, indexRecordBlobs])
          }
        },
        { signal: controller.signal },
      )
      .catch((err) => controller.abort(err))
  }
  await recordQueue.onIdle()
  controller.signal.throwIfAborted()
}

export const findBlobRefs = (val: LexValue, layer = 0): BlobRef[] => {
  if (layer > 32) {
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
