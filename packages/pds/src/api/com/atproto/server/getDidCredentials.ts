import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { InvalidRequestError } from '@atproto/xrpc-server'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.getDidCredentials({
    auth: ctx.authVerifier.access,
    handler: async ({ auth }) => {
      const requester = auth.credentials.did
      const signingKey = await ctx.actorStore.keypair(requester)
      const verificationMethods = {
        atproto: signingKey,
      }
      const account = await ctx.accountManager.getAccount(requester)
      const alsoKnownAs = account?.handle ? [account.handle] : undefined
      const rotationKeys = [ctx.plcRotationKey.did()]
      if (ctx.cfg.identity.recoveryDidKey) {
        rotationKeys.unshift(ctx.cfg.identity.recoveryDidKey)
      }

      const services = {
        atproto_pds: {
          type: 'AtprotoPersonalDataServer',
          endpoint: 'https://puffball.us-east.host.bsky.network',
        },
      }

      return {
        encoding: 'application/json',
        body: {
          alsoKnownAs,
          verificationMethods,
          rotationKeys,
          services,
        },
      }
    },
  })
}
