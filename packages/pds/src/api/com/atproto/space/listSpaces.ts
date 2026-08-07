import { SpaceRefString } from '@atproto/syntax'
import { Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.listSpaces, {
    auth: ctx.authVerifier.authorization({
      authorize: () => {
        // Performed in the handler as it requires the query params
      },
    }),
    handler: async ({ params, auth }) => {
      const { type, did: authority, limit, cursor } = params

      // No one space to check against, so the filters are the target: an
      // unfiltered listing needs a wildcard grant. Lists only the caller's own
      // spaces, so `read_self` is the grant that fits; `read` satisfies it too.
      if (auth.credentials.type === 'oauth') {
        auth.credentials.permissions.assertSpace({
          type: type ?? '*',
          authority: authority ?? '*',
          skey: '*',
          action: 'read_self',
        })
      }

      const spaces = await ctx.actorStore.read(auth.credentials.did, (store) =>
        store.space.listSpaces({ limit, cursor, type, authority }),
      )

      return {
        encoding: 'application/json' as const,
        body: {
          cursor: spaces.length < limit ? undefined : spaces.at(-1)?.uri,
          spaces: spaces.map((space) => ({
            uri: space.uri as SpaceRefString,
          })),
        },
      }
    },
  })
}
