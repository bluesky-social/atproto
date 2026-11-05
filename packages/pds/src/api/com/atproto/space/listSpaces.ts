import { LtHash } from '@atproto/space'
import type { Server } from '@atproto/xrpc-server'
import { AuthScope } from '../../../../auth-scope.js'
import type { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.listSpaces, {
    auth: ctx.authVerifier.authorization({
      additional: [AuthScope.Takendown],
      authorize: () => {
        // Performed in the handler as it requires the query params
      },
    }),
    handler: async ({ params, auth }) => {
      const { spaceDid, spaceType, limit, cursor } = params

      // No one space to check against, so the filters are the target: an
      // unfiltered listing needs a wildcard grant. Lists only the caller's own
      // spaces, so `read_self` is the grant that fits; `read` satisfies it too.
      if (auth.credentials.type === 'oauth') {
        auth.credentials.permissions.assertSpace(
          {
            spaceType: spaceType ?? '*',
            authority: spaceDid ?? '*',
            skey: '*',
          },
          { action: 'read_self' },
        )
      }

      const spaces = await ctx.actorStore.read(auth.credentials.did, (store) =>
        store.space.listSpaces({
          limit,
          cursor,
          type: spaceType,
          authority: spaceDid,
        }),
      )

      return {
        encoding: 'application/json',
        body: {
          cursor: spaces.length < limit ? undefined : spaces.at(-1)?.uri,
          spaces: spaces.map((space) => ({
            space: space.uri,
            repoRev: space.repoRev ?? undefined,
            data: space.setHash
              ? new LtHash(space.setHash).digest()
              : undefined,
            spaceRev: space.spaceRev ?? undefined,
          })),
        },
      }
    },
  })
}
