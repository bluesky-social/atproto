import { TID } from '@atproto/common'
import { SpaceUri } from '@atproto/syntax'
import { InvalidRequestError, Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { assertSpaceScope } from '../space/util.js'
import { fromLexAppAccess } from './config.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.simplespace.createSpace, {
    auth: ctx.authVerifier.authorization({
      authorize: () => {
        // Performed in the handler as it requires the request body
      },
    }),
    handler: async ({ input, auth }) => {
      const did = auth.credentials.did
      const { type, config } = input.body
      const skey = input.body.skey ?? TID.nextStr()
      const spaceUri = SpaceUri.make(input.body.did, type, skey)
      const space = spaceUri.toString()
      const isOwner = input.body.did === did

      // createSpace is a space-level "manage" (create) operation.
      assertSpaceScope(auth, space, { manage: 'create' })

      const appAccess = config?.appAccess
        ? fromLexAppAccess(config.appAccess)
        : {}

      await ctx.actorStore.transact(did, async (actorTxn) => {
        const alreadyExists = await actorTxn.space.getSpace(space)
        if (alreadyExists) {
          throw new InvalidRequestError(
            'Space already exists',
            'SpaceAlreadyExists',
          )
        }
        await actorTxn.space.createSpace(space, isOwner, {
          mintPolicy: config?.mintPolicy,
          managingApp: config?.managingApp,
          ...appAccess,
        })

        // The authority is a member of its own space by default.
        if (isOwner) {
          await actorTxn.space.addMember(space, did)
        }
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
