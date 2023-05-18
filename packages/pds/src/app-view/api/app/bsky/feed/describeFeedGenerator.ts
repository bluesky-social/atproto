import { Server } from '../../../../../lexicon'
import AppContext from '../../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.describeFeedGenerator(async () => {
    const feeds = Object.keys(ctx.algos).map((uri) => ({ uri }))

    return {
      encoding: 'application/json',
      body: {
        did: ctx.cfg.serverDid,
        feeds,
      },
    }
  })
}
