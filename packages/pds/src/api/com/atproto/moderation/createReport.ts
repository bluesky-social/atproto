import { AtpAgent } from '@atproto/api'
import { AuthScope } from '../../../../auth-verifier'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { ids } from '../../../../lexicon/lexicons'
import { parseProxyInfo } from '../../../../pipethrough'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.moderation.createReport({
    auth: ctx.authVerifier.accessStandard({
      additional: [AuthScope.Takendown],
    }),
    handler: async ({ auth, input, req }) => {
      const { url, did: aud } = await parseProxyInfo(
        ctx,
        req,
        ids.ComAtprotoModerationCreateReport,
      )
      const agent = new AtpAgent({ service: url })
      const serviceAuth = await ctx.serviceAuthHeaders(
        auth.credentials.did,
        aud,
        ids.ComAtprotoModerationCreateReport,
      )
      const res = await agent.com.atproto.moderation.createReport(input.body, {
        ...serviceAuth,
        encoding: 'application/json',
      })

      return {
        encoding: 'application/json',
        body: res.data,
      }
    },
  })
}
