import { Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { computeProxyTo } from '../../../../pipethrough'
import {
  LocalRecords,
  LocalViewer,
  pipethroughReadAfterWrite,
} from '../../../../read-after-write'
import { app } from '#lexicons'

export default function (server: Server, ctx: AppContext) {
  if (!ctx.bskyAppView) return

  server.add(app.bsky.feed.getTimeline, {
    auth: ctx.authVerifier.authorization({
      authorize: (permissions, { req }) => {
        const lxm = app.bsky.feed.getTimeline.$lxm
        const aud = computeProxyTo(ctx, req, lxm)
        permissions.assertRpc({ aud, lxm })
      },
    }),
    handler: async (reqCtx) => {
      return pipethroughReadAfterWrite(ctx, reqCtx, getTimelineMunge)
    },
  })
}

const getTimelineMunge = async (
  localViewer: LocalViewer,
  original: app.bsky.feed.getTimeline.OutputBody,
  local: LocalRecords,
): Promise<app.bsky.feed.getTimeline.OutputBody> => {
  const feed = await localViewer.formatAndInsertPostsInFeed(
    [...original.feed],
    local.posts,
  )
  return {
    ...original,
    feed,
  }
}
