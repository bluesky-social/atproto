import { SECOND } from '@atproto/common'
import { randomStr } from '@atproto/crypto'
import { xrpc } from '@atproto/lex-client'
import {
  createSpaceCredential,
  isP256DidKey,
  parseSpaceToken,
  spaceHostAud,
} from '@atproto/space'
import {
  type DidString,
  type SpaceRefString,
  toDatetimeString,
} from '@atproto/syntax'
import { InvalidRequestError, type Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { spaceLogger } from '../../../../logger.js'
import { assertActiveSpaceHost, toSpaceRef } from './util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.authorizeSpaceSync, {
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

      await assertActiveSpaceHost(ctx, ref)
      const { spaceDid } = ref

      // The durable signal that a space is gone: a syncer that missed its
      // deletion notice learns it here, the next time it reauthorizes. Answered
      // regardless of the request's authorization, since a public space's syncer
      // may not have a delegation token.
      const existing = await ctx.actorStore.read(spaceDid, (store) =>
        store.space.getSpace(space),
      )
      if (existing?.deletedAt) {
        throw new InvalidRequestError('Space has been deleted', 'SpaceDeleted')
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

      const clientId = clientAttestation
        ? await ctx.clientAttestationVerifier.verify(
            clientAttestation,
            spaceHostAud(spaceDid),
          )
        : undefined

      const policy = await ctx.actorStore.read(spaceDid, (store) =>
        store.space.getActiveSpacePolicy(space),
      )

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

      if (notify) {
        const registered = await ctx.actorStore.read(spaceDid, (store) =>
          store.space.getNotifyRegistration(space, notify),
        )
        if (!registered) {
          await confirmRegistration(ctx, space, notify)
        }
      }

      const keypair = await ctx.actorStore.keypair(spaceDid)
      const credential = await createSpaceCredential({
        iss: spaceDid,
        sub: space,
        keyId: credentialKey,
        keypair,
      })

      if (notify) {
        // Renewed by each authorization, so a syncer that keeps reauthorizing
        // stays registered.
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

      // Read after registering, so any update past this revision is notified.
      const spaceRev = await ctx.actorStore.read(spaceDid, (store) =>
        store.space.getSpaceRev(space),
      )

      return {
        encoding: 'application/json',
        body: { credential, spaceRev },
      }
    },
  })
}

/**
 * Before registering an endpoint, check that it asked to be registered: the
 * endpoint must recognize the token as one it issued for this space, and echo
 * back a random challenge.
 */
async function confirmRegistration(
  ctx: AppContext,
  space: SpaceRefString,
  notify: com.atproto.space.authorizeSpaceSync.Notify,
): Promise<void> {
  const { endpoint, token } = notify
  const challenge = randomStr(16, 'base32')
  try {
    // The endpoint is chosen by the requester, so it's fetched as untrusted.
    const res = await xrpc(
      { service: endpoint, fetch: ctx.safeFetch },
      com.atproto.space.confirmRegistration,
      {
        body: { space, token, challenge },
        signal: AbortSignal.timeout(10 * SECOND),
      },
    )
    if (res.body.challenge === challenge) return
  } catch (err) {
    spaceLogger.warn({ err, space, endpoint }, 'registration not confirmed')
  }
  throw new InvalidRequestError(
    'Notify endpoint did not confirm the registration',
    'RegistrationNotConfirmed',
  )
}
