import { InvalidRequestError, type Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../context.js'
import { app, tools } from '../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(tools.ozone.moderation.getAccountPreferences, {
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ params }) => {
      if (!ctx.pdsClient || !ctx.cfg.pds) {
        throw new InvalidRequestError('PDS not configured')
      }

      // @NOTE `did` is an internal moderator parameter omitted from the public
      // Lexicon, so the generated client rejects it before sending.

      const auth = await ctx.pdsAuth(app.bsky.actor.getPreferences.$lxm)
      return ctx.pdsClient.xrpc(app.bsky.actor.getPreferences, {
        params: { did: params.did },
        headers: auth?.headers,
        signal: AbortSignal.timeout(30_000),
      })
    },
  })
}
