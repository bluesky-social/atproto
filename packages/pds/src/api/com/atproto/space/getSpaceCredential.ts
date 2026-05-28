import { createSpaceCredential } from '@atproto/space'
import { SpaceUri } from '@atproto/syntax'
import { InvalidRequestError, Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.getSpaceCredential, {
    auth: ctx.authVerifier.memberGrantAuth,
    handler: async ({ input, auth }) => {
      const { space, notifyEndpoint } = input.body
      const { memberDid, aud, clientId, space: grantSpace } = auth.credentials

      if (grantSpace !== space) {
        throw new InvalidRequestError(
          'Grant space does not match requested space',
          'InvalidGrant',
        )
      }

      const ownerDid = new SpaceUri(space).spaceDid
      if (aud !== ownerDid) {
        throw new InvalidRequestError(
          'Grant audience does not match space owner',
          'InvalidGrant',
        )
      }

      const { spaceRow, isMember } = await ctx.actorStore.read(
        ownerDid,
        async (store) => ({
          spaceRow: await store.space.getSpace(space),
          isMember: await store.space.isMember(space, memberDid),
        }),
      )
      if (!spaceRow) {
        throw new InvalidRequestError('Space not found', 'SpaceNotFound')
      }
      if (spaceRow.deletedAt) {
        throw new InvalidRequestError('Space has been deleted', 'SpaceDeleted')
      }
      // Read perimeter. Public spaces skip the member-list check; private
      // spaces require the grant subject to be a member.
      // TODO: support truly anonymous mint for public spaces (no member grant
      // at all) — requires a different auth flow for client identification.
      if (!spaceRow.isPublic && !isMember) {
        throw new InvalidRequestError('Member not found in space', 'NotAMember')
      }
      // App perimeter. allow-mode refuses clientIds in appExceptions;
      // deny-mode refuses clientIds NOT in appExceptions.
      const appExceptionMatch = spaceRow.appExceptions.includes(clientId)
      const appAllowed =
        spaceRow.appAccessMode === 'deny'
          ? appExceptionMatch
          : !appExceptionMatch
      if (!appAllowed) {
        throw new InvalidRequestError(
          'Application not permitted to sync this space',
          'AppNotPermitted',
        )
      }

      const keypair = await ctx.actorStore.keypair(ownerDid)
      const credential = await createSpaceCredential(
        {
          iss: ownerDid,
          space,
          clientId,
        },
        keypair,
      )

      // Register the requesting service to receive notifyWrite events.
      // FIXME: recipient table is keyed (space, serviceDid). Using memberDid
      // here preserves prior behavior but is wrong when one service syncs for
      // many members; revisit when reworking the fan-out layer.
      if (notifyEndpoint) {
        await ctx.actorStore.transact(ownerDid, async (actorTxn) => {
          await actorTxn.space.recordCredentialRecipient(
            space,
            memberDid,
            notifyEndpoint,
          )
        })
      }

      return {
        encoding: 'application/json' as const,
        body: { credential },
      }
    },
  })
}
