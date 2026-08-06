import { createSpaceToken } from '@atproto/space'
import { InvalidRequestError, Server } from '@atproto/xrpc-server'
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
