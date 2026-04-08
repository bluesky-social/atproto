import { TID } from '@atproto/common'
import { SpaceUri } from '@atproto/syntax'
import { InvalidRequestError, Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { com } from '../../../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.createSpace, {
    auth: ctx.authVerifier.authorization({ authorize: () => {} }),
    handler: async ({ input, auth }) => {
      const did = auth.credentials.did
      const { type } = input.body
      const skey = input.body.skey ?? TID.nextStr()
      const spaceUri = SpaceUri.make(input.body.did, type, skey)
      const space = spaceUri.toString()

      await ctx.actorStore.transact(did, async (actorTxn) => {
        const alreadyExists = await actorTxn.space.getSpace(space)
        if (alreadyExists) {
          throw new InvalidRequestError(
            'Space already exists',
            'SpaceAlreadyExists',
          )
        }
        await actorTxn.space.createSpace(space, input.body.did === did)
      })

      return {
        encoding: 'application/json' as const,
        body: {
          uri: space,
        },
      }
    },
  })
}
