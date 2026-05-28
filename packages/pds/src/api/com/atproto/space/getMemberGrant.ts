import { createMemberGrant } from '@atproto/space'
import { SpaceUri } from '@atproto/syntax'
import { Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { assertSpaceScope } from './util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.getMemberGrant, {
    auth: ctx.authVerifier.authorization({
      authorize: () => {
        // Performed in the handler as it requires the `space` param
      },
    }),
    handler: async ({ params, auth }) => {
      const memberDid = auth.credentials.did
      const { space } = params

      // The grant is a "user X via app Y is asking the owner" envelope. The
      // owner's PDS decides whether to honor it (via member list, isPublic,
      // appAccessMode, etc.); the caller's PDS only attests to identity +
      // app, gated by the OAuth scope. Local isMember is a cached hint set by
      // notifyMembership and isn't authoritative.
      assertSpaceScope(auth, space, { action: 'read' })

      const ownerDid = new SpaceUri(space).spaceDid
      const keypair = await ctx.actorStore.keypair(memberDid)

      // @TODO: extract clientId from OAuth credentials
      // OAuthOutput doesn't expose clientId currently — using placeholder
      const clientId = 'unknown'

      const grant = await createMemberGrant(
        {
          iss: memberDid,
          aud: ownerDid,
          space,
          clientId,
        },
        keypair,
      )

      return {
        encoding: 'application/json' as const,
        body: { grant },
      }
    },
  })
}
