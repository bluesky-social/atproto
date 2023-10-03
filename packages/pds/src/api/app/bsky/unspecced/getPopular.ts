import { Server } from '../../../../lexicon'
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
      const res = await ctx.appViewAgent.api.app.bsky.feed.getFeed(
        { feed: HOT_CLASSIC_URI, limit: params.limit, cursor: params.cursor },
        await ctx.serviceAuthHeaders(requester, HOT_CLASSIC_DID),
      )
      return {
        encoding: 'application/json',
        body: res.data,
      }
    },
  })
}
