import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { OutputSchema } from '../../../../lexicon/types/app/bsky/feed/getTimeline'
import { handleReadAfterWrite } from '../util/read-after-write'
import { LocalRecords } from '../../../../services/local'
import {
  authPassthru,
  proxy,
  proxyAppView,
  resultPassthru,
} from '../../../proxy'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getTimeline({
    auth: ctx.authVerifier.access,
    handler: async ({ params, auth, req }) => {
      const proxied = await proxy(
        ctx,
        auth.credentials.audience,
        async (agent) => {
          const result = await agent.api.app.bsky.feed.getTimeline(
            params,
            authPassthru(req),
          )
          return resultPassthru(result)
        },
      )
      if (proxied !== null) {
        return proxied
      }

      const requester = auth.credentials.did
      const res = await proxyAppView(ctx, async (agent) =>
        agent.api.app.bsky.feed.getTimeline(
          params,
          await ctx.appviewAuthHeaders(requester),
        ),
      )
      return await handleReadAfterWrite(ctx, requester, res, getTimelineMunge)
    },
  })
}

const getTimelineMunge = async (
  ctx: AppContext,
  original: OutputSchema,
  local: LocalRecords,
): Promise<OutputSchema> => {
  const feed = await ctx.services
    .local(ctx.db)
    .formatAndInsertPostsInFeed([...original.feed], local.posts)
  return {
    ...original,
    feed,
  }
}
