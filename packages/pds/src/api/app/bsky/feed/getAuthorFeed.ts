import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { ids } from '../../../../lexicon/lexicons'
import { isReasonRepost } from '../../../../lexicon/types/app/bsky/feed/defs'
import { OutputSchema } from '../../../../lexicon/types/app/bsky/feed/getAuthorFeed'
import { computeProxyTo } from '../../../../pipethrough'
import {
  LocalRecords,
  LocalViewer,
  pipethroughReadAfterWrite,
} from '../../../../read-after-write'

export default function (server: Server, ctx: AppContext) {
  if (!ctx.bskyAppView) return

  server.app.bsky.feed.getAuthorFeed({
    auth: ctx.authVerifier.authorization({
      authorize: (permissions, { req }) => {
        const lxm = ids.AppBskyFeedGetAuthorFeed
        const aud = computeProxyTo(ctx, req, lxm)
        permissions.assertRpc({ aud, lxm })
      },
    }),
    handler: async (reqCtx) => {
      return pipethroughReadAfterWrite(ctx, reqCtx, getAuthorMunge)
    },
  })
}

const getAuthorMunge = async (
  localViewer: LocalViewer,
  original: OutputSchema,
  local: LocalRecords,
  requester: string,
): Promise<OutputSchema> => {
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

const isUsersFeed = (feed: OutputSchema, requester: string) => {
  const first = feed.feed.at(0)
  if (!first) return false
  if (!first.reason && first.post.author.did === requester) return true
  if (isReasonRepost(first.reason) && first.reason.by.did === requester)
    return true
  return false
}
