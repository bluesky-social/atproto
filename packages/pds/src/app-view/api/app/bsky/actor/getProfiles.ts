import { Server } from '../../../../../lexicon'
import AppContext from '../../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.actor.getProfiles({
    auth: ctx.accessVerifier,
    handler: async ({ req, auth, params }) => {
      const requester = auth.credentials.did
      if (ctx.canProxyRead(req)) {
        const res = await ctx.appviewAgent.api.app.bsky.actor.getProfiles(
          params,
          await ctx.serviceAuthHeaders(requester),
        )
        return {
          encoding: 'application/json',
          body: res.data,
        }
      }

      const { actors } = params
      const { db, services } = ctx
      const actorService = services.appView.actor(db)

      const actorsRes = await actorService.getActors(actors)

      return {
        encoding: 'application/json',
        body: {
          profiles: await actorService.views.hydrateProfilesDetailed(
            actorsRes,
            requester,
          ),
        },
      }
    },
  })
}
