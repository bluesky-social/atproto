import * as common from '@atproto/common'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { PostView } from '../../../../lexicon/types/app/bsky/feed/defs'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getPosts({
    auth: ctx.authOptionalVerifier,
    handler: async ({ params, auth }) => {
      const requester = auth.credentials.did

      const uris = common.dedupeStrs(params.uris)

      const postViews = await ctx.services
        .feed(ctx.db)
        .getPostViews(uris, requester)

      const posts: PostView[] = []
      for (const uri of uris) {
        const post = postViews[uri]
        const isBlocked =
          post?.author.viewer?.blockedBy === true ||
          typeof post?.author.viewer?.blocking === 'string'
        if (post && !isBlocked) {
          posts.push(post)
        }
      }

      return {
        encoding: 'application/json',
        body: { posts },
      }
    },
  })
}
