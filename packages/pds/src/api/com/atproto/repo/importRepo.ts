import { TID } from '@atproto/common'
import { LexMap, enumBlobRefs } from '@atproto/lex-data'
import {
  BlockMap,
  WriteOpAction,
  getAndParseRecord,
  readCarStream,
  verifyDiff,
} from '@atproto/repo'
import { AtUri } from '@atproto/syntax'
import { InvalidRequestError, Server } from '@atproto/xrpc-server'
import { ACCESS_FULL } from '../../../../auth-scope'
import { AppContext } from '../../../../context'
import { com } from '../../../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.repo.importRepo, {
    opts: {
      blobLimit: ctx.cfg.service.maxImportSize,
    },
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

      // @NOTE process as much as we can before the transaction, in particular
      // the reading of the body stream.
      const { roots, blocks } = await readCarStream(input.body)
      if (roots.length !== 1) {
        await blocks.dump()
        throw new InvalidRequestError('expected one root')
      }

      const blockMap = new BlockMap()
      for await (const block of blocks) {
        blockMap.set(block.cid, block.bytes)
      }

      await ctx.actorStore.transact(did, async (store) => {
        const now = new Date().toISOString()
        const rev = TID.nextStr()
        const did = store.repo.did

        const currRepo = await store.repo.maybeLoadRepo()
        const diff = await verifyDiff(
          currRepo,
          blockMap,
          roots[0],
          undefined,
          undefined,
          { ensureLeaves: false },
        )
        diff.commit.rev = rev
        await store.repo.storage.applyCommit(diff.commit, currRepo === null)

        // @NOTE There is no point in performing the following concurrently
        // since better-sqlite3 is synchronous.
        for (const write of diff.writes) {
          const uri = AtUri.make(did, write.collection, write.rkey)
          if (write.action === WriteOpAction.Delete) {
            await store.record.deleteRecord(uri)
          } else {
            let parsedRecord: LexMap
            try {
              // @NOTE getAndParseRecord returns a promise for historical
              // reasons but it's internal processing is actually synchronous.
              const parsed = await getAndParseRecord(blockMap, write.cid)
              parsedRecord = parsed.record
            } catch {
              throw new InvalidRequestError(
                `Could not parse record at '${write.collection}/${write.rkey}'`,
              )
            }

            await store.record.indexRecord(
              uri,
              write.cid,
              parsedRecord,
              write.action,
              rev,
              now,
            )
            const recordBlobs = Array.from(enumBlobRefs(parsedRecord))
            await store.repo.blob.insertBlobs(uri.toString(), recordBlobs)
          }
        }
      })
    },
  })
}
