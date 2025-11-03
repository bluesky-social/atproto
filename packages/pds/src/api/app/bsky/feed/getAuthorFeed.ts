import { ForbiddenError } from '@atproto/xrpc-server'
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
import { AccessControlService } from '../../../../services/access-control'

export default function (server: Server, ctx: AppContext) {
  if (!ctx.bskyAppView) return

  const accessControl = new AccessControlService(ctx.actorStore)

  server.app.bsky.feed.getAuthorFeed({
    auth: ctx.authVerifier.authorizationOrAdminTokenOptional({
      authorize: (permissions, { req }) => {
        const lxm = ids.AppBskyFeedGetAuthorFeed
        const aud = computeProxyTo(ctx, req, lxm)
        permissions.assertRpc({ aud, lxm })
      },
    }),
    handler: async (reqCtx) => {
      const { params, auth } = reqCtx
      const requester = auth?.credentials?.did ?? null

      // Resolve actor DID from handle or DID
      const actorDid = await ctx.idResolver.actor.resolve(params.actor)

      if (!actorDid) {
        throw new Error('Profile not found')
      }

      // Check access control
      const accessResult = await accessControl.canViewProfile(
        requester,
        actorDid,
      )

      // If unauthorized, throw forbidden error
      if (!accessResult.canView) {
        throw new ForbiddenError('Profile is private')
      }

      // Authorized - continue with normal proxy logic
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
