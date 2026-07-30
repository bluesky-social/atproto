import { TID } from '@atproto/common'
import { AtUriString } from '@atproto/syntax'
import { ForbiddenError, Server } from '@atproto/xrpc-server'
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

      const commit = await ctx.actorStore.transact(did, (actorTxn) =>
        actorTxn.space.applyWrites(space, [
          { action: 'create', collection, rkey, record },
        ]),
      )

      await fireNotifyWrite(ctx, {
        space,
        writerDid: did,
        rev: commit.rev,
        setHash: commit.setHash,
      })

      const [result] = commit.results
      return {
        encoding: 'application/json' as const,
        body: {
          uri: `${space}/${did}/${collection}/${rkey}` as AtUriString,
          cid: result.cid!.toString(),
        },
      }
    },
  })
}
