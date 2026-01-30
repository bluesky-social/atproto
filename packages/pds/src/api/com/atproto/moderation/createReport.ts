import { Client } from '@atproto/lex'
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
    handler: async ({ auth, input, req }) => {
      const { url, did: aud } = await parseProxyInfo(
        ctx,
        req,
        com.atproto.moderation.createReport.$lxm,
      )
      const client = new Client({ service: url })
      const serviceAuth = await ctx.serviceAuthHeaders(
        auth.credentials.did,
        aud,
        com.atproto.moderation.createReport.$lxm,
      )

      return {
        encoding: 'application/json' as const,
        body: await client.call(
          com.atproto.moderation.createReport,
          input.body,
          serviceAuth,
        ),
      }
    },
  })
}
