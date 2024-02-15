import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { getPdsEndpoint, getSigningKey } from '@atproto/common'
import { InvalidRequestError } from '@atproto/xrpc-server'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.activateAccount({
    auth: ctx.authVerifier.accessNotAppPassword,
    handler: async ({ auth }) => {
      const requester = auth.credentials.did
      let pdsEndpoint: string | undefined
      let signingKey: string | undefined
      if (requester.startsWith('did:plc')) {
        const resolved = await ctx.plcClient.getDocumentData(requester)
        pdsEndpoint = resolved.services['atproto_pds']?.endpoint
        signingKey = resolved.verificationMethods['atproto']
        if (!resolved.rotationKeys.includes(ctx.plcRotationKey.did())) {
          throw new InvalidRequestError(
            'Server rotation key not included in PLC DID data',
          )
        }
      } else {
        const resolved = await ctx.idResolver.did.resolve(requester, true)
        if (!resolved) {
          throw new InvalidRequestError('Could not resolve DID')
        }
        pdsEndpoint = getPdsEndpoint(resolved)
        // @TODO tidy this up using SDK methods
        const pubkeyMultibase = getSigningKey(resolved)?.publicKeyMultibase
        signingKey = pubkeyMultibase ? `did:key:${pubkeyMultibase}` : undefined
      }
      const keypair = await ctx.actorStore.keypair(requester)
      if (!signingKey || signingKey !== keypair.did()) {
        throw new InvalidRequestError(
          'DID document verification method does not match expected signing key',
        )
      }
      if (!pdsEndpoint || pdsEndpoint !== ctx.cfg.service.publicUrl) {
        throw new InvalidRequestError(
          'DID document atproto_pds service endpoint does not match PDS public url',
        )
      }

      await ctx.accountManager.activateAccount(requester)
    },
  })
}
