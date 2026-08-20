import { createSpaceToken, spaceHostAud } from '@atproto/space'
import { InvalidRequestError, type Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { assertSpaceHost } from './util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.getSpaceCredential, {
    auth: ctx.authVerifier.delegationTokenAuth,
    handler: async ({ input, auth }) => {
      const { space, clientAttestation } = input.body
      const { userDid, space: tokenSpace, dpopJkt } = auth.credentials

      if (tokenSpace !== space) {
        throw new InvalidRequestError(
          'Delegation token subject does not match requested space',
          'InvalidDelegationToken',
        )
      }

      const spaceDid = await assertSpaceHost(ctx, space)

      const clientId = clientAttestation
        ? await ctx.clientAttestationVerifier.verify(
            clientAttestation,
            spaceHostAud(spaceDid),
          )
        : undefined

      const config = await ctx.actorStore.read(spaceDid, async (store) => {
        const existing = await store.space.getSpace(space)
        if (existing?.deletedAt) {
          // The durable signal that a space is gone: a syncer that missed
          // notifySpaceDeleted learns it here, on its next renewal.
          throw new InvalidRequestError(
            'Space has been deleted',
            'SpaceDeleted',
          )
        }
        return store.space.getActiveSpaceConfig(space)
      })

      await ctx.simpleSpaceManager.authorizeCredential({
        config,
        userDid,
        clientId,
      })

      const keypair = await ctx.actorStore.keypair(spaceDid)
      const credential = await createSpaceToken(
        'credential',
        { iss: spaceDid, sub: space, dpopJkt },
        keypair,
      )

      return {
        encoding: 'application/json' as const,
        body: { credential },
      }
    },
  })
}
