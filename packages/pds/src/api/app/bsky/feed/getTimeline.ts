import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { OutputSchema } from '../../../../lexicon/types/app/bsky/feed/getTimeline'
import {
  LocalViewer,
  handleReadAfterWrite,
  LocalRecords,
} from '../../../../read-after-write'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getTimeline({
    auth: ctx.authVerifier.access,
    handler: async ({ params, auth }) => {
      const requester = auth.credentials.did
      const res = await ctx.appViewAgent.api.app.bsky.feed.getTimeline(
        params,
        await ctx.appviewAuthHeaders(requester),
      )
      return await handleReadAfterWrite(ctx, requester, res, getTimelineMunge)
    },
  })
}

const getTimelineMunge = async (
  localViewer: LocalViewer,
  original: OutputSchema,
  local: LocalRecords,
): Promise<OutputSchema> => {
  const feed = await localViewer.formatAndInsertPostsInFeed(
    [...original.feed],
    local.posts,
  )
  return {
    ...original,
    feed,
  }
}
