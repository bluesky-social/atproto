import { createSpaceToken } from '@atproto/space'
import { InvalidRequestError, Server } from '@atproto/xrpc-server'
import { isAppAuthorized } from '../../../../actor-store/space/index.js'
import { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { toSpaceRef } from './util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.getSpaceCredential, {
    auth: ctx.authVerifier.delegationTokenAuth,
    handler: async ({ input, auth }) => {
      const { space, clientAttestation } = input.body
      const { userDid, space: tokenSpace } = auth.credentials

      if (tokenSpace !== space) {
        throw new InvalidRequestError(
          'Delegation token subject does not match requested space',
          'InvalidDelegationToken',
        )
      }

      const { spaceDid } = toSpaceRef(space)

      const clientId = clientAttestation
        ? await ctx.clientAttestationVerifier.verify(
            clientAttestation,
            `${spaceDid}#atproto_space_host`,
          )
        : undefined

      const { spaceRow, checked } = await ctx.actorStore.read(
        spaceDid,
        async (store) => {
          const spaceRow = await store.space.getSpace(space)
          if (!spaceRow) return { spaceRow, checked: false as const }
          return {
            spaceRow,
            checked: await store.space.checkUserAuthorized(spaceRow, userDid),
          }
        },
      )
      if (!spaceRow) {
        throw new InvalidRequestError('Space not found', 'SpaceNotFound')
      }
      if (spaceRow.deletedAt) {
        // The durable signal that a space is gone: a syncer that missed
        // notifySpaceDeleted learns it here, on its next renewal.
        throw new InvalidRequestError('Space has been deleted', 'SpaceDeleted')
      }

      // The app perimeter runs first: it is local and decides without reference to
      // the user, so a refused app is never disclosed to a third-party managing app.
      if (!isAppAuthorized(spaceRow, clientId)) {
        throw new InvalidRequestError(
          'Application not authorized for this space',
          'AppNotAuthorized',
        )
      }

      const userAuthorized = await ctx.simpleSpaceManager.authorizeUser({
        space: spaceRow,
        checked,
        userDid,
        clientId,
      })
      if (!userAuthorized) {
        throw new InvalidRequestError(
          'User not authorized for this space',
          'UserNotAuthorized',
        )
      }

      const keypair = await ctx.actorStore.keypair(spaceDid)
      const credential = await createSpaceToken(
        'credential',
        { iss: spaceDid, sub: space },
        keypair,
      )

      return {
        encoding: 'application/json' as const,
        body: { credential },
      }
    },
  })
}
