import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { getPdsEndpoint, getSigningDidKey } from '@atproto/common'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { authPassthru } from '../../../proxy'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.activateAccount({
    auth: ctx.authVerifier.accessNotAppPassword,
    handler: async ({ auth, req }) => {
      if (ctx.entrywayAgent) {
        await ctx.entrywayAgent.com.atproto.server.activateAccount(
          undefined,
          authPassthru(req, true),
        )
        return
      }

      const requester = auth.credentials.did
      if (requester.startsWith('did:plc')) {
        const resolved = await ctx.plcClient.getDocumentData(requester)
        await assertValidDocContents(ctx, requester, {
          pdsEndpoint: resolved.services['atproto_pds']?.endpoint,
          signingKey: resolved.verificationMethods['atproto'],
          rotationKeys: resolved.rotationKeys,
        })
      } else {
        const resolved = await ctx.idResolver.did.resolve(requester, true)
        if (!resolved) {
          throw new InvalidRequestError('Could not resolve DID')
        }
        await assertValidDocContents(ctx, requester, {
          pdsEndpoint: getPdsEndpoint(resolved),
          signingKey: getSigningDidKey(resolved),
        })
      }

      await ctx.accountManager.activateAccount(requester)
    },
  })
}

const assertValidDocContents = async (
  ctx: AppContext,
  did: string,
  contents: {
    signingKey?: string
    pdsEndpoint?: string
    rotationKeys?: string[]
  },
) => {
  const { signingKey, pdsEndpoint, rotationKeys } = contents
  if (
    rotationKeys !== undefined &&
    !rotationKeys.includes(ctx.plcRotationKey.did())
  ) {
    throw new InvalidRequestError(
      'Server rotation key not included in PLC DID data',
    )
  }

  if (!pdsEndpoint || pdsEndpoint !== ctx.cfg.service.publicUrl) {
    throw new InvalidRequestError(
      'DID document atproto_pds service endpoint does not match PDS public url',
    )
  }

  const keypair = await ctx.actorStore.keypair(did)
  if (!signingKey || signingKey !== keypair.did()) {
    throw new InvalidRequestError(
      'DID document verification method does not match expected signing key',
    )
  }
}
