import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { ids } from '../../../../lexicon/lexicons'
import { OutputSchema } from '../../../../lexicon/types/app/bsky/feed/getTimeline'
import {
  LocalRecords,
  LocalViewer,
  pipethroughReadAfterWrite,
} from '../../../../read-after-write'

export default function (server: Server, ctx: AppContext) {
  const { bskyAppView } = ctx
  if (!bskyAppView) return

  server.app.bsky.feed.getTimeline({
    auth: ctx.authVerifier.authorization({
      authorize: ({ permissions }) => {
        permissions.assertRpc({
          aud: `${bskyAppView.did}#bsky_appview`,
          lxm: ids.AppBskyFeedGetTimeline,
        })
      },
    }),
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
