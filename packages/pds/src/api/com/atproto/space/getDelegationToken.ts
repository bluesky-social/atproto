import { createSpaceToken } from '@atproto/space'
import { SpaceUri } from '@atproto/syntax'
import { Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { assertSpaceScope } from './util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.getDelegationToken, {
    auth: ctx.authVerifier.authorization({
      authorize: () => {
        // Performed in the handler as it requires the `space` param
      },
    }),
    handler: async ({ params, auth }) => {
      const userDid = auth.credentials.did
      const { space } = params

      // The token asserts user→app delegation, gated by the OAuth scope. It
      // makes no claim that the user is a member — that's the authority's call.
      // `read` (not read_self) is required: read_self does not grant
      // whole-space access and so cannot be exchanged for a credential.
      assertSpaceScope(auth, space, { action: 'read' })

      const authorityDid = new SpaceUri(space).authorityDid
      const keypair = await ctx.actorStore.keypair(userDid)

      const token = await createSpaceToken(
        'delegation',
        {
          iss: userDid,
          sub: space,
          // Addressed to the space host (service fragment of the authority), so
          // it can't be replayed against a different authority.
          aud: `${authorityDid}#atproto_space_host`,
        },
        keypair,
      )

      return {
        encoding: 'application/json' as const,
        body: { token },
      }
    },
  })
}
