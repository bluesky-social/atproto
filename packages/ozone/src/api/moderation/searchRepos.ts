import { mapDefined } from '@atproto/common'
import { AppContext } from '../../context'
import { Server } from '../../lexicon'
import { ids } from '../../lexicon/lexicons'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.moderation.searchRepos({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ params }) => {
      const modService = ctx.modService(ctx.db)

      // prefer new 'q' query param over deprecated 'term'
      const query = params.q ?? params.term

      // special case for did searches - do exact match
      if (query?.startsWith('did:')) {
        const repos = await modService.views.repos([query])
        const found = repos.get(query)
        return {
          encoding: 'application/json',
          body: {
            repos: found ? [found] : [],
          },
        }
      }

      const res = await ctx.appviewAgent.api.app.bsky.actor.searchActors(
        params,
        await ctx.appviewAuth(ids.AppBskyActorSearchActors),
      )
      const repoMap = await modService.views.repos(
        res.data.actors.map((a) => a.did),
      )
      const repos = mapDefined(res.data.actors, (actor) =>
        repoMap.get(actor.did),
      )
      return {
        encoding: 'application/json',
        body: {
          cursor: res.data.cursor,
          repos,
        },
      }
    },
  })
}
