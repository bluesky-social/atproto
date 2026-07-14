import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import { app } from '../../../../lexicons/index.js'
import { computeProxyTo } from '../../../../pipethrough.js'
import {
  type MungeFn,
  pipethroughReadAfterWrite,
} from '../../../../read-after-write/index.js'

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
    opts: {
      // @TODO remove after grace period has passed, behavior is non-standard.
      // temporarily added for compat w/ previous version of xrpc-server to avoid breakage of a few specified parties.
      paramsParseLoose: true,
    },
    handler: async (reqCtx) => {
      return pipethroughReadAfterWrite(
        ctx,
        reqCtx,
        app.bsky.feed.getTimeline,
        getTimelineMunge,
      )
    },
  })
}

const getTimelineMunge: MungeFn<app.bsky.feed.getTimeline.$OutputBody> = async (
  localViewer,
  original,
  local,
) => {
  const feed = await localViewer.formatAndInsertPostsInFeed(
    [...original.feed],
    local.posts,
  )
  return {
    ...original,
    feed,
  }
}
