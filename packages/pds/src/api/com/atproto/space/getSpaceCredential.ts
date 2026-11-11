import { SECOND } from '@atproto/common'
import {
  createSpaceCredential,
  isP256DidKey,
  parseSpaceToken,
  spaceHostAud,
} from '@atproto/space'
import { type DidString, toDatetimeString } from '@atproto/syntax'
import { InvalidRequestError, type Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { assertActiveSpaceHost, toSpaceRef } from './util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.getSpaceCredential, {
    handler: async ({ input: { body } }) => {
      const {
        space,
        credentialKey,
        delegationToken,
        clientAttestation,
        notify,
      } = body
      const ref = toSpaceRef(space)

      if (!isP256DidKey(credentialKey)) {
        throw new InvalidRequestError('credentialKey must be a P-256 did:key')
      }

      // Absent when the request carries no delegation token, which only a space
      // that does not gate on the account accepts.
      let repo: DidString | undefined
      if (delegationToken) {
        const delegation =
          await ctx.authVerifier.verifyDelegationToken(delegationToken)
        if (delegation.space !== space) {
          throw new InvalidRequestError(
            'Delegation token subject does not match requested space',
            'InvalidDelegationToken',
          )
        }
        repo = delegation.repo
      }

      await assertActiveSpaceHost(ctx, ref)
      const { spaceDid } = ref

      const clientId = clientAttestation
        ? await ctx.clientAttestationVerifier.verify(
            clientAttestation,
            spaceHostAud(spaceDid),
          )
        : undefined

      const policy = await ctx.actorStore.read(spaceDid, async (store) => {
        const existing = await store.space.getSpace(space)
        // The durable signal that a space is gone: a syncer that missed its
        // notifySpaceStatus learns it here, on its next renewal. Answered with or
        // without a delegation token, since a public space's syncer may not have one.
        if (existing?.deletedAt) {
          throw new InvalidRequestError(
            'Space has been deleted',
            'SpaceDeleted',
          )
        }
        return store.space.getActiveSpacePolicy(space)
      })

      try {
        await ctx.spacePolicyManager.authorizeCredential({
          space: ref,
          policy,
          repo,
          clientId,
        })
      } catch (err) {
        // A refused request withdraws the registration it carries, so a syncer
        // that has lost access to the space stops being notified.
        if (notify) {
          await ctx.actorStore.transact(spaceDid, (actorTxn) =>
            actorTxn.space.removeNotifyRegistration(space, notify),
          )
        }
        throw err
      }

      const keypair = await ctx.actorStore.keypair(spaceDid)
      const credential = await createSpaceCredential({
        iss: spaceDid,
        sub: space,
        keyId: credentialKey,
        keypair,
      })

      if (notify) {
        // Renewed by each credential request, so a syncer that keeps its
        // credential fresh stays registered.
        const { exp } = parseSpaceToken('credential', credential).payload
        await ctx.actorStore.transact(spaceDid, (actorTxn) =>
          actorTxn.space.putNotifyRegistration({
            space,
            endpoint: notify.endpoint,
            token: notify.token,
            expiresAt: toDatetimeString(exp * SECOND),
          }),
        )
      }

      return {
        encoding: 'application/json',
        body: { credential },
      }
    },
  })
}
