import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.identity.getRecommendedDidCredentials({
    auth: ctx.authVerifier.access,
    handler: async ({ auth }) => {
      const requester = auth.credentials.did
      const signingKey = await ctx.actorStore.keypair(requester)
      const verificationMethods = {
        atproto: signingKey.did(),
      }
      const account = await ctx.accountManager.getAccount(requester, {
        includeDeactivated: true,
      })
      const alsoKnownAs = account?.handle
        ? [`at://${account.handle}`]
        : undefined

      const plcRotationKey =
        ctx.cfg.entryway?.plcRotationKey ?? ctx.plcRotationKey.did()
      const rotationKeys = [plcRotationKey]
      if (ctx.cfg.identity.recoveryDidKey) {
        rotationKeys.unshift(ctx.cfg.identity.recoveryDidKey)
      }

      const services = {
        atproto_pds: {
          type: 'AtprotoPersonalDataServer',
          endpoint: ctx.cfg.service.publicUrl,
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
