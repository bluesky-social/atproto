import { getPdsEndpoint } from '@atproto/common'
import { xrpc } from '@atproto/lex'
import { SpaceUri } from '@atproto/syntax'
import {
  InvalidRequestError,
  Server,
  createServiceAuthHeaders,
} from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { com } from '../../../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.addMember, {
    auth: ctx.authVerifier.authorization({ authorize: () => {} }),
    handler: async ({ input, auth }) => {
      const ownerDid = auth.credentials.did
      const { space, did: memberDid } = input.body

      // Verify space exists and caller is owner
      const spaceRow = await ctx.actorStore.read(ownerDid, (store) =>
        store.space.getSpace(space),
      )
      if (!spaceRow) {
        throw new InvalidRequestError('Space not found', 'SpaceNotFound')
      }
      if (!spaceRow.isOwner) {
        throw new InvalidRequestError('Not the space owner', 'NotSpaceOwner')
      }

      // Add member to owner's member list
      await ctx.actorStore.transact(ownerDid, async (actorTxn) => {
        await actorTxn.space.addMember(space, memberDid)
      })

      // Notify member's PDS
      const spaceDid = new SpaceUri(space).spaceDid
      const memberDidDoc = await ctx.idResolver.did.resolve(memberDid)
      if (!memberDidDoc) {
        throw new InvalidRequestError('Could not resolve member DID')
      }
      const memberPdsUrl = getPdsEndpoint(memberDidDoc)
      if (!memberPdsUrl) {
        throw new InvalidRequestError('Could not resolve member PDS endpoint')
      }

      const keypair = await ctx.actorStore.keypair(spaceDid)
      const { headers } = await createServiceAuthHeaders({
        iss: spaceDid,
        aud: memberDid,
        lxm: com.atproto.space.notifyMembership.$lxm,
        keypair,
      })

      await xrpc(memberPdsUrl, com.atproto.space.notifyMembership, {
        headers,
        body: { space, did: memberDid, isMember: true },
      })
    },
  })
}
