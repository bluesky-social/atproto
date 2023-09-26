import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import { GenericKeyset } from '../../../../db/pagination'
import AppContext from '../../../../context'

// THIS IS A TEMPORARY UNSPECCED ROUTE
export default function (server: Server, ctx: AppContext) {
  server.app.bsky.unspecced.getPopular({
    auth: ctx.accessVerifier,
    handler: async ({ auth, params }) => {
      const requester = auth.credentials.did
      const HOT_CLASSIC_URI =
        'at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/hot-classic'
      const HOT_CLASSIC_DID = 'did:plc:5fllqkujj6kqp5izd5jg7gox'
      const res = await ctx.appviewAgent.api.app.bsky.feed.getFeed(
        { feed: HOT_CLASSIC_URI, limit: params.limit, cursor: params.cursor },
        await ctx.serviceAuthHeaders(requester, HOT_CLASSIC_DID),
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
