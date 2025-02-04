import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { pipethrough } from '../../../../pipethrough'
import { ids } from '../../../../lexicon/lexicons'
import { AtUri } from '@atproto/syntax'
import { InvalidRequestError } from '@atproto/oauth-provider'

export default function (server: Server, ctx: AppContext) {
  const { bskyAppView } = ctx
  if (!bskyAppView) return

  server.app.bsky.feed.getFeed({
    auth: ctx.authVerifier.accessStandard(),
    handler: async ({ params, auth, req }) => {
      const requester = auth.credentials.did

      const feedUrl = new AtUri(params.feed)
      const { data } = await bskyAppView.agent.com.atproto.repo.getRecord({
        repo: feedUrl.hostname,
        collection: feedUrl.collection,
        rkey: feedUrl.rkey,
      })
      const feedDid = data.value['did']
      if (typeof feedDid !== 'string') {
        throw new InvalidRequestError(
          'could not resolve feed did',
          'UnknownFeed',
        )
      }

      return pipethrough(ctx, req, {
        iss: requester,
        aud: feedDid,
        lxm: ids.AppBskyFeedGetFeedSkeleton,
      })
    },
  })
}
