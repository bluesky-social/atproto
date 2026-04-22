import { SpaceUri } from '@atproto/syntax'
import { createMemberGrant } from '@atproto/space'
import { InvalidRequestError, Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { com } from '../../../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.getMemberGrant, {
    auth: ctx.authVerifier.authorization({ authorize: () => {} }),
    handler: async ({ params, auth }) => {
      const memberDid = auth.credentials.did
      const { space } = params

      // Verify the space exists in member's actor store and they're a member
      const spaceRow = await ctx.actorStore.read(memberDid, (store) =>
        store.space.getSpace(space),
      )
      if (!spaceRow) {
        throw new InvalidRequestError('Space not found', 'SpaceNotFound')
      }
      if (!spaceRow.isMember) {
        throw new InvalidRequestError('Not a member of this space', 'NotAMember')
      }

      // Parse space URI to extract owner DID
      const spaceUri = new SpaceUri(space)
      const ownerDid = spaceUri.spaceDid

      // Get member's keypair
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
