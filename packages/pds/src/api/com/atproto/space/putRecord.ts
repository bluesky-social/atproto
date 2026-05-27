import { cidForLex } from '@atproto/lex-cbor'
import { SpaceRepo, WriteOpAction } from '@atproto/space'
import { SpaceUriString } from '@atproto/syntax'
import { ForbiddenError, Server } from '@atproto/xrpc-server'
import { SqlRepoStorage } from '../../../../actor-store/space/index.js'
import { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { assertSpaceScope, fireNotifyWrite } from './util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.putRecord, {
    auth: ctx.authVerifier.authorization({
      authorize: () => {
        // Performed in the handler as it requires the request body
      },
    }),
    handler: async ({ input, auth }) => {
      const did = auth.credentials.did
      const { space, repo, collection, rkey, record } = input.body
      if (repo !== did) {
        throw new ForbiddenError('repo must match authenticated user')
      }

      assertSpaceScope(auth, space, { action: 'create', collection })
      assertSpaceScope(auth, space, { action: 'update', collection })

      const result = await ctx.actorStore.transact(did, async (actorTxn) => {
        const storage = new SqlRepoStorage(actorTxn.space, space)
        const repoStore = await SpaceRepo.loadOrCreate(storage, did)
        const exists = await storage.hasRecord(collection, rkey)
        const action = exists ? WriteOpAction.Update : WriteOpAction.Create
        const commit = await repoStore.formatCommit({
          action,
          collection,
          rkey,
          record,
        })
        const rev = await actorTxn.space.applyRepoCommit(space, commit)
        const cid = await cidForLex(record)
        return { cid: cid.toString(), rev }
      })

      await fireNotifyWrite(ctx, space, did, result.rev)

      return {
        encoding: 'application/json' as const,
        body: {
          uri: `${space}/${did}/${collection}/${rkey}` as SpaceUriString,
          cid: result.cid,
        },
      }
    },
  })
}
