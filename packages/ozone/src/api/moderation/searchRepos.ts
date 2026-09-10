import { mapDefined } from '@atproto/common'
import { isDidString } from '@atproto/lex'
import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../context.js'
import { app, tools } from '../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(tools.ozone.moderation.searchRepos, {
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ params }) => {
      const modService = ctx.modService(ctx.db)

      // prefer new 'q' query param over deprecated 'term'
      const query = params.q ?? params.term

      // special case for did searches - do exact match
      if (query?.startsWith('did:')) {
        if (!isDidString(query)) {
          // Invalid did format, return empty result
          return {
            encoding: 'application/json',
            body: { repos: [] },
          }
        }

        const did = query
        const repos = await modService.views.repos([did])
        const found = repos.get(did)
        return {
          encoding: 'application/json',
          body: {
            repos: found ? [found] : [],
          },
        }
      }

      const body = await ctx.appviewClient.call(
        app.bsky.actor.searchActors,
        params,
        await ctx.appviewAuth(app.bsky.actor.searchActors.$lxm),
      )
      const repoMap = await modService.views.repos(
        body.actors.map((a) => a.did),
      )
      const repos = mapDefined(body.actors, (actor) => repoMap.get(actor.did))
      return {
        encoding: 'application/json',
        body: {
          cursor: body.cursor,
          repos,
        },
      }
    },
  })
}
