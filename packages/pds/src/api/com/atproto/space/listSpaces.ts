import { Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { com } from '../../../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.listSpaces, {
    auth: ctx.authVerifier.authorization({
      authorize: (permissions, { params }) => {
        const type = (params.type as string | undefined) ?? '*'
        const did = (params.did as string | undefined) ?? '*'
        permissions.assertSpace({ type, did, skey: '*', action: 'read' })
      },
    }),
    handler: async ({ params, auth }) => {
      const did = auth.credentials.did
      const { type, did: ownerDid, limit, cursor } = params

      const spaces = await ctx.actorStore.read(did, (store) =>
        store.space.listSpaces({
          limit: limit ?? 50,
          cursor,
          type,
          did: ownerDid,
        }),
      )

      return {
        encoding: 'application/json' as const,
        body: {
          cursor: spaces.at(-1)?.uri,
          spaces: spaces.map((s) => ({
            uri: s.uri,
            isOwner: s.isOwner,
          })),
        },
      }
    },
  })
}
