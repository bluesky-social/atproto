import { SpaceUri } from '@atproto/syntax'
import { InvalidRequestError, Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { com } from '../../../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.getMemberState, {
    auth: ctx.authVerifier.spaceCredentialAuth,
    handler: async ({ params, auth }) => {
      const { space } = params

      if (auth.credentials.space !== space) {
        throw new InvalidRequestError('Credential space mismatch')
      }

      const ownerDid = new SpaceUri(space).spaceDid
      const state = await ctx.actorStore.read(ownerDid, (store) =>
        store.space.getMemberState(space),
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
