import { InvalidRequestError, Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { com } from '../../../../lexicons/index.js'
import { assertSpaceScope } from './util'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.getRepoState, {
    auth: ctx.authVerifier.authorizationOrSpaceCredential({
      authorize: () => {
        // Performed in the handler as it requires the `space` param
      },
    }),
    handler: async ({ params, auth }) => {
      const { space, did } = params

      if (auth.credentials.type === 'space_credential') {
        if (auth.credentials.space !== space) {
          throw new InvalidRequestError('Credential space mismatch')
        }
      } else {
        assertSpaceScope(auth, space, { action: 'read' })
      }

      const state = await ctx.actorStore.read(did, (store) =>
        store.space.getRepoState(space),
      )

      return {
        encoding: 'application/json' as const,
        body: {
          setHash: state?.setHash ? state.setHash.toString('hex') : undefined,
          rev: state?.rev ?? undefined,
        },
      }
    },
  })
}
