import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { OutputSchema } from '../../../../lexicon/types/app/bsky/feed/getTimeline'
import {
  LocalRecords,
  LocalViewer,
  pipethroughReadAfterWrite,
} from '../../../../read-after-write'

export default function (server: Server, ctx: AppContext) {
  if (!ctx.bskyAppView) return

  server.app.bsky.feed.getTimeline({
    auth: ctx.authVerifier.accessStandard(),
    handler: async (reqCtx) => {
      return pipethroughReadAfterWrite(ctx, reqCtx, getTimelineMunge)
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
