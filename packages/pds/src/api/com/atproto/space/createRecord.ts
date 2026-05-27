import { TID } from '@atproto/common'
import { cidForLex } from '@atproto/lex-cbor'
import { SpaceRepo, WriteOpAction } from '@atproto/space'
import { SpaceUriString } from '@atproto/syntax'
import { ForbiddenError, Server } from '@atproto/xrpc-server'
import { SqlRepoStorage } from '../../../../actor-store/space/index.js'
import { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { assertSpaceScope, fireNotifyWrite } from './util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.createRecord, {
    auth: ctx.authVerifier.authorization({
      authorize: () => {
        // Performed in the handler as it requires the request body
      },
    }),
    handler: async ({ input, auth }) => {
      const did = auth.credentials.did
      const { space, repo, collection, record } = input.body
      if (repo !== did) {
        throw new ForbiddenError('repo must match authenticated user')
      }
      const rkey = input.body.rkey ?? TID.nextStr()

      assertSpaceScope(auth, space, { action: 'create', collection })

      const result = await ctx.actorStore.transact(did, async (actorTxn) => {
        const storage = new SqlRepoStorage(actorTxn.space, space)
        const repoStore = await SpaceRepo.loadOrCreate(storage, did)
        const commit = await repoStore.formatCommit({
          action: WriteOpAction.Create,
          collection,
          rkey,
          record,
        })
        const rev = await actorTxn.space.applyRepoCommit(space, commit)
        const cid = await cidForLex(record)
        return { cid: cid.toString(), rkey, rev }
      })

      await fireNotifyWrite(ctx, space, did, result.rev)

      return {
        encoding: 'application/json' as const,
        body: {
          uri: `${space}/${did}/${collection}/${result.rkey}` as SpaceUriString,
          cid: result.cid,
        },
      }
    },
  })
}
