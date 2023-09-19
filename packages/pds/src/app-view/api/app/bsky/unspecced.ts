import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import { GenericKeyset } from '../../../../db/pagination'
import AppContext from '../../../../context'

// @NOTE currently relies on the hot-classic feed being configured on the pds
// THIS IS A TEMPORARY UNSPECCED ROUTE
export default function (server: Server, ctx: AppContext) {
  server.app.bsky.unspecced.getPopular({
    auth: ctx.accessVerifier,
    handler: async ({ params, auth }) => {
      const requester = auth.credentials.did
      const hotClassicUri = Object.keys(ctx.algos).find((uri) =>
        uri.endsWith('/hot-classic'),
      )
      if (!hotClassicUri) {
        return {
          encoding: 'application/json',
          body: { feed: [] },
        }
      }
      const { data: feed } =
        await ctx.appviewAgent.api.app.bsky.feed.getFeedGenerator(
          { feed: hotClassicUri },
          await ctx.serviceAuthHeaders(requester),
        )
      const res = await ctx.appviewAgent.api.app.bsky.feed.getFeed(
        { feed: hotClassicUri, limit: params.limit, cursor: params.cursor },
        await ctx.serviceAuthHeaders(requester, feed.view.did),
      )
      return {
        encoding: 'application/json',
        body: res.data,
      }
    },
  })

  server.app.bsky.unspecced.getPopularFeedGenerators({
    auth: ctx.accessVerifier,
    handler: async ({ auth, params }) => {
      const requester = auth.credentials.did
      const res =
        await ctx.appviewAgent.api.app.bsky.unspecced.getPopularFeedGenerators(
          params,
          await ctx.serviceAuthHeaders(requester),
        )
      return {
        encoding: 'application/json',
        body: res.data,
      }
    },
  })

  server.app.bsky.unspecced.applyLabels({
    auth: ctx.roleVerifier,
    handler: async ({ auth, input }) => {
      if (!auth.credentials.admin) {
        throw new AuthRequiredError('Insufficient privileges')
      }
      const { services, db } = ctx
      const { labels } = input.body
      await services.appView.label(db).createLabels(labels)
    },
  })
}

type Result = { likeCount: number; cid: string }
type LabeledResult = { primary: number; secondary: string }
export class LikeCountKeyset extends GenericKeyset<Result, LabeledResult> {
  labelResult(result: Result) {
    return {
      primary: result.likeCount,
      secondary: result.cid,
    }
  }
  labeledResultToCursor(labeled: LabeledResult) {
    return {
      primary: labeled.primary.toString(),
      secondary: labeled.secondary,
    }
  }
  cursorToLabeledResult(cursor: { primary: string; secondary: string }) {
    const likes = parseInt(cursor.primary, 10)
    if (isNaN(likes)) {
      throw new InvalidRequestError('Malformed cursor')
    }
    return {
      primary: likes,
      secondary: cursor.secondary,
    }
  }
}
