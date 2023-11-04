import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import {
  authPassthru,
  ensureThisPds,
  getStreamingRequestInit,
  proxy,
} from '../../../proxy'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.repo.uploadBlob({
    auth: ctx.authVerifier.accessCheckTakedown,
    handler: async ({ auth, input, req }) => {
      const proxied = await proxy(
        ctx,
        auth.credentials.audience,
        async (agent) => {
          const reqInit = getStreamingRequestInit(input.body)
          reqInit.method = req.method
          reqInit.headers = {
            ...authPassthru(req)?.headers,
            'content-type':
              req.headers['content-type'] || 'application/octet-stream',
          }
          const res = await fetch(`${agent.service.origin}${req.path}`, reqInit)
          return {
            encoding: 'application/json' as const,
            body: await res.json(),
          }
        },
      )
      if (proxied !== null) {
        return proxied
      }

      ensureThisPds(ctx, auth.credentials.pdsDid)

      const requester = auth.credentials.did
      const blob = await ctx.services
        .repo(ctx.db)
        .blobs.addUntetheredBlob(requester, input.encoding, input.body)

      return {
        encoding: 'application/json',
        body: {
          blob,
        },
      }
    },
  })
}
