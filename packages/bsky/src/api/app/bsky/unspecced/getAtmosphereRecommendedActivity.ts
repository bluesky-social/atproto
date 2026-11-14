import { mapDefined, noUndefinedVals } from '@atproto/common'
import {
  ForbiddenError,
  MethodNotImplementedError,
  type Server,
} from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import { app, site, social } from '../../../../lexicons/index.js'
import { getAtprotoPassthroughHeaders } from '../../../../util/headers.js'
import { recordUriOf } from '../../../../util/uris.js'
import { resHeaders } from '../../../util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(app.bsky.unspecced.getAtmosphereRecommendedActivity, {
    auth: ctx.authVerifier.standardReadOptional(),
    handler: async ({ auth, params, req, signal }) => {
      const viewer = auth.credentials.iss
      const features = ctx.featureGatesClient.scope(
        ctx.featureGatesClient.parseUserContextFromHandler({ viewer, req }),
      )
      if (!features.checkGate(features.Gate.AtmosphereScreenEndpointsEnable)) {
        throw new ForbiddenError(
          'Atmosphere recommended activity is not enabled',
        )
      }
      if (!ctx.irisClient) {
        // @NOTE Clients should not retry when Iris is not configured.
        throw new MethodNotImplementedError('Iris agent not available')
      }
      const hydrateCtx = await ctx.hydrator.createContext({
        viewer,
        features,
        labelers: ctx.reqLabelers(req),
        xrpcEndpoint: app.bsky.unspecced.getAtmosphereRecommendedActivity.$lxm,
      })
      const recommendations = await ctx.irisClient.call(
        app.bsky.unspecced.getAtmosphereActivityRecommendations,
        { viewer: viewer ?? undefined, limit: params.limit },
        {
          headers: noUndefinedVals({
            'accept-language': params.langs?.length
              ? params.langs.join(',')
              : req.headers['accept-language'],
            ...getAtprotoPassthroughHeaders(req),
          }),
          signal,
          validateResponse: true,
        },
      )
      const uris = [
        ...new Set(
          mapDefined(
            recommendations.items.slice(0, params.limit),
            ({ uri }) =>
              recordUriOf(uri, site.standard.document.$type) ??
              recordUriOf(uri, social.grain.gallery.$type),
          ),
        ),
      ]
      const state = await ctx.hydrator.hydrateEmbedExternalViewFromUris(
        uris,
        hydrateCtx,
        { hydration: 'basic' },
      )
      const items = mapDefined(uris, (uri) => {
        const view = ctx.views.externalRecordView(uri, state)
        if (!view) return
        if (app.bsky.embed.external.viewGallery.$isTypeOf(view)) {
          return view.items.length ? { view } : undefined
        }
        return app.bsky.embed.external.viewArticle.$isTypeOf(view)
          ? { view }
          : undefined
      })
      return {
        encoding: 'application/json',
        body: { items, recIdStr: recommendations.recIdStr },
        headers: resHeaders({ labelers: hydrateCtx.labelers }),
      }
    },
  })
}
