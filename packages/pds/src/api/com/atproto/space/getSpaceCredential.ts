import { createSpaceToken, isP256DidKey, spaceHostAud } from '@atproto/space'
import type { DidString } from '@atproto/syntax'
import { InvalidRequestError, type Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { assertSpaceHost } from './util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.getSpaceCredential, {
    handler: async ({ input }) => {
      const { space, credentialKid, delegationToken, clientAttestation } =
        input.body

      if (!isP256DidKey(credentialKid)) {
        throw new InvalidRequestError('credentialKid must be a P-256 did:key')
      }

      // Absent when the request carries no delegation token, which only a space
      // that does not gate on the user accepts.
      let userDid: DidString | undefined
      if (delegationToken) {
        const delegation =
          await ctx.authVerifier.verifyDelegationToken(delegationToken)
        if (delegation.space !== space) {
          throw new InvalidRequestError(
            'Delegation token subject does not match requested space',
            'InvalidDelegationToken',
          )
        }
        userDid = delegation.userDid
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
        // The durable signal that a space is gone: a syncer that missed
        // notifySpaceDeleted learns it here, on its next renewal. Without a
        // delegation token, getActiveSpaceConfig answers SpaceNotFound instead: the
        // read policy is deleted with the space, so we can't tell it was public.
        if (existing?.deletedAt && userDid) {
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
        { iss: spaceDid, sub: space, keyId: credentialKid },
        keypair,
      )

      return {
        encoding: 'application/json' as const,
        body: { credential },
      }
    },
  })
}
