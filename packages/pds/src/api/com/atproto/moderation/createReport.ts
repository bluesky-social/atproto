import { buildAgent, xrpc } from '@atproto/lex'
import { Server } from '@atproto/xrpc-server'
import { AuthScope } from '../../../../auth-scope'
import { AppContext } from '../../../../context'
import { com } from '../../../../lexicons/index.js'
import { computeProxyTo, parseProxyInfo } from '../../../../pipethrough'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.moderation.createReport, {
    auth: ctx.authVerifier.authorization({
      additional: [AuthScope.Takendown],
      authorize: (permissions, { req }) => {
        const lxm = com.atproto.moderation.createReport.$lxm
        const aud = computeProxyTo(ctx, req, lxm)
        permissions.assertRpc({ aud, lxm })
      },
    }),
    handler: async ({ auth, input: { body }, req }) => {
      const { url, did: aud } = await parseProxyInfo(
        ctx,
        req,
        com.atproto.moderation.createReport.$lxm,
      )

      const { headers } = await ctx.serviceAuthHeaders(
        auth.credentials.did,
        aud,
        com.atproto.moderation.createReport.$lxm,
      )

      // @TODO remove buildAgent() after https://github.com/bluesky-social/atproto/pull/4672
      return xrpc(buildAgent(url), com.atproto.moderation.createReport, {
        body,
        headers,
      })
    },
  })
}
