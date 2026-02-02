import { Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { app } from '../../../../lexicons/index.js'
import { computeProxyTo } from '../../../../pipethrough'
import {
  MungeFn,
  pipethroughReadAfterWrite,
} from '../../../../read-after-write'

export default function (server: Server, ctx: AppContext) {
  if (!ctx.bskyAppView) return

  server.add(app.bsky.feed.getAuthorFeed, {
    auth: ctx.authVerifier.authorization({
      authorize: (permissions, { req }) => {
        const lxm = app.bsky.feed.getAuthorFeed.$lxm
        const aud = computeProxyTo(ctx, req, lxm)
        permissions.assertRpc({ aud, lxm })
      },
    }),
    handler: async (reqCtx) => {
      return pipethroughReadAfterWrite(
        ctx,
        reqCtx,
        app.bsky.feed.getAuthorFeed,
        getAuthorMunge,
      )
    },
  })
}

const getAuthorMunge: MungeFn<app.bsky.feed.getAuthorFeed.OutputBody> = async (
  localViewer,
  original,
  local,
  requester,
) => {
  const localProf = local.profile
  // only munge on own feed
  if (!isUsersFeed(original, requester)) {
    return original
  }
  let feed = original.feed
  // first update any out of date profile pictures in feed
  if (localProf) {
    feed = feed.map((item) => {
      if (item.post.author.did === requester) {
        return {
          ...item,
          post: {
            ...item.post,
            author: localViewer.updateProfileViewBasic(
              item.post.author,
              localProf.record,
            ),
          },
        }
      } else {
        return item
      }
    })
  }
  feed = await localViewer.formatAndInsertPostsInFeed(feed, local.posts)
  return {
    ...original,
    feed,
  }
}

const isUsersFeed = (
  feed: app.bsky.feed.getAuthorFeed.OutputBody,
  requester: string,
) => {
  const first = feed.feed.at(0)
  if (!first) return false
  if (!first.reason && first.post.author.did === requester) return true
  if (
    app.bsky.feed.defs.reasonRepost.$matches(first.reason) &&
    first.reason.by.did === requester
  )
    return true
  return false
}
