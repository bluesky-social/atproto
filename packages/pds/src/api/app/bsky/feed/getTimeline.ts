import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { OutputSchema } from '../../../../lexicon/types/app/bsky/feed/getTimeline'
import {
  LocalViewer,
  handleReadAfterWrite,
  LocalRecords,
} from '../../../../read-after-write'
import { pipethrough } from '../../../../pipethrough'

const METHOD_NSID = 'app.bsky.feed.getTimeline'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getTimeline({
    auth: ctx.authVerifier.access,
    handler: async ({ params, auth }) => {
      const requester = auth.credentials.did
      const res = await pipethrough(
        ctx.cfg.bskyAppView.url,
        METHOD_NSID,
        params,
        await ctx.appviewAuthHeaders(requester),
      )
      return await handleReadAfterWrite(
        ctx,
        METHOD_NSID,
        requester,
        res,
        getTimelineMunge,
      )
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
