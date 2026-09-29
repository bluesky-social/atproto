import type { DidString } from '@atproto/lex'
import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../context.js'
import { tools } from '../../lexicons/index.js'
import { getReposForVerifications } from '../../verification/util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(tools.ozone.verification.listVerifications, {
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ req, params, auth }) => {
      const modViews = ctx.modService(ctx.db).views
      const verificationService = ctx.verificationService(ctx.db)
      const { verifications, cursor } = await verificationService.list(params)

      const dids = new Set<DidString>()
      for (const verification of verifications) {
        dids.add(verification.subject)
        dids.add(verification.issuer)
      }

      const didsArr = Array.from(dids)
      const [repos, profiles] = await Promise.all([
        getReposForVerifications(
          ctx,
          ctx.reqLabelers(req),
          ctx.modService(ctx.db),
          didsArr,
          auth.credentials.isModerator,
        ),
        modViews.getProfiles(didsArr),
      ])

      return {
        encoding: 'application/json',
        body: {
          cursor,
          verifications: verificationService.view(
            verifications,
            repos,
            profiles,
          ),
        },
      }
    },
  })
}
