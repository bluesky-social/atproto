import { xrpc } from '@atproto/lex'
import { Server } from '@atproto/xrpc-server'
import { AuthScope } from '../../../../auth-scope.js'
import { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { computeProxyTo, parseProxyInfo } from '../../../../pipethrough.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.moderation.createReport, {
    auth: ctx.authVerifier.authorization({
      additional: [AuthScope.Takendown],
      authorize: (permissions, { req }) => {
        const lxm = com.atproto.moderation.createReport.$lxm
        const scopeAud = computeProxyTo(ctx, req, lxm)
        permissions.assertRpc({ aud: scopeAud, lxm })
      },
    }),
    handler: async ({ auth, params, input: { body }, req }) => {
      // Phase 1 of service auth updates: scope check (in authorize, above)
      // sees the combined did#serviceId form, the outbound service-auth JWT
      // keeps bare-DID aud.
      const { url, did: tokenAud } = await parseProxyInfo(
        ctx,
        req,
        com.atproto.moderation.createReport.$lxm,
      )

      const { headers } = await ctx.serviceAuthHeaders(
        auth.credentials.did,
        tokenAud,
        com.atproto.moderation.createReport.$lxm,
      )

      return xrpc(url, com.atproto.moderation.createReport, {
        validateRequest: ctx.cfg.service.devMode,
        validateResponse: ctx.cfg.service.devMode,
        strictResponseProcessing: ctx.cfg.service.devMode,
        headers,
        params,
        body,
      })
    },
  })
}
