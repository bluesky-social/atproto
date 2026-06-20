import { InvalidRequestError, Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context.js'
import { app } from '../../../../lexicons/index.js'
import { resHeaders } from '../../../util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(app.bsky.poll.getPoll, {
    auth: ctx.authVerifier.standardOptional,
    handler: async ({ params, auth, req }) => {
      const { viewer, includeTakedowns, skipViewerBlocks } =
        ctx.authVerifier.parseCreds(auth)
      const labelers = ctx.reqLabelers(req)
      const hydrateCtx = await ctx.hydrator.createContext({
        labelers,
        viewer,
        includeTakedowns,
        skipViewerBlocks,
      })

      const hydration = await ctx.hydrator.hydratePolls(
        [{ uri: params.uri, cid: params.cid }],
        hydrateCtx,
      )

      if (!hydration.polls?.get(params.uri)) {
        throw new InvalidRequestError('Poll not found', 'NotFound')
      }

      const view = ctx.views.pollView(params.uri, hydration)
      if (view.$type === 'app.bsky.embed.poll#pollViewNotFound') {
        throw new InvalidRequestError('Poll not found', 'NotFound')
      }

      return {
        encoding: 'application/json',
        body: { poll: view },
        headers: resHeaders({ labelers: hydrateCtx.labelers }),
      }
    },
  })
}
