import * as common from '@atproto/common'
import { Server } from '../../../../../lexicon'
import AppContext from '../../../../../context'
import { AtUri } from '@atproto/uri'
import { PostView } from '@atproto/api/src/client/types/app/bsky/feed/defs'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getPosts({
    auth: ctx.accessVerifier,
    handler: async ({ params, auth }) => {
      const requester = auth.credentials.did

      const feedService = ctx.services.appView.feed(ctx.db)
      const labelService = ctx.services.appView.label(ctx.db)

      const uris = common.dedupeStrs(params.uris)
      const dids = common.dedupeStrs(
        params.uris.map((uri) => new AtUri(uri).hostname),
      )

      const [actors, postViews, embeds, labels] = await Promise.all([
        feedService.getActorViews(Array.from(dids), requester),
        feedService.getPostViews(Array.from(uris), requester),
        feedService.embedsForPosts(Array.from(uris), requester),
        labelService.getLabelsForSubjects(Array.from(uris)),
      ])

      const posts: PostView[] = []
      for (const uri of uris) {
        const post = feedService.formatPostView(
          uri,
          actors,
          postViews,
          embeds,
          labels,
        )
        if (post) {
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
