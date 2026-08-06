import { SpaceRefString } from '@atproto/syntax'
import { Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.listSpaces, {
    auth: ctx.authVerifier.authorization({
      authorize: (permissions, { params }) => {
        const type = (params.type as string | undefined) ?? '*'
        const authority = (params.did as string | undefined) ?? '*'
        permissions.assertSpace({ type, authority, skey: '*', action: 'read' })
      },
    }),
    handler: async ({ params, auth }) => {
      const { type, did: authority, limit, cursor } = params

      const spaces = await ctx.actorStore.read(auth.credentials.did, (store) =>
        store.space.listSpaces({ limit, cursor, type, authority }),
      )

      return {
        encoding: 'application/json' as const,
        body: {
          cursor: spaces.at(-1)?.uri,
          spaces: spaces.map((space) => ({
            uri: space.uri as SpaceRefString,
          })),
        },
      }
    },
  })
}
