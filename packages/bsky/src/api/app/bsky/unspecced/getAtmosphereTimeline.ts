import { ForbiddenError, type Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import { app } from '../../../../lexicons/index.js'
import { resHeaders } from '../../../util.js'
import { loadAtmosphereTimeline } from './atmosphere-pagination.js'

export default function (server: Server, ctx: AppContext) {
  server.add(app.bsky.unspecced.getAtmosphereTimeline, {
    auth: ctx.authVerifier.standard,
    handler: async ({ auth, params, req }) => {
      const now = Date.now()
      const viewer = auth.credentials.iss
      const features = ctx.featureGatesClient.scope(
        ctx.featureGatesClient.parseUserContextFromHandler({ viewer, req }),
      )
      if (!features.checkGate(features.Gate.AtmosphereScreenEndpointsEnable)) {
        throw new ForbiddenError('Atmosphere timeline is not enabled')
      }
      const hydrateCtx = await ctx.hydrator.createContext({
        viewer,
        features,
        labelers: ctx.reqLabelers(req),
        xrpcEndpoint: app.bsky.unspecced.getAtmosphereTimeline.$lxm,
      })
      const body = await loadAtmosphereTimeline(
        ctx,
        hydrateCtx,
        params.cursor,
        now,
      )
      return {
        encoding: 'application/json',
        body,
        headers: resHeaders({ labelers: hydrateCtx.labelers }),
      }
    },
  })
}
