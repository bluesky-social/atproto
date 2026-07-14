import { InvalidRequestError } from '@atproto/oauth-provider/errors'
import { AtUri } from '@atproto/syntax'
import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import { app, com } from '../../../../lexicons/index.js'
import { computeProxyTo, pipethrough } from '../../../../pipethrough.js'

export default function (server: Server, ctx: AppContext) {
  const { bskyAppView } = ctx
  if (!bskyAppView) return

  server.add(app.bsky.feed.getFeed, {
    auth: ctx.authVerifier.authorization({
      authorize: (permissions, { req }) => {
        const lxm = app.bsky.feed.getFeed.$lxm
        const aud = computeProxyTo(ctx, req, lxm)
        permissions.assertRpc({ aud, lxm })
        permissions.assertRpc({ aud, lxm: app.bsky.feed.getFeedSkeleton.$lxm })
      },
    }),
    handler: async ({ params, auth, req }) => {
      const requester = auth.credentials.did

      const feedUrl = new AtUri(params.feed)

      const data = await bskyAppView.client.call(com.atproto.repo.getRecord, {
        repo: feedUrl.host,
        collection: feedUrl.collectionSafe,
        rkey: feedUrl.rkeySafe,
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
        lxm: app.bsky.feed.getFeedSkeleton.$lxm,
      })
    },
  })
}
