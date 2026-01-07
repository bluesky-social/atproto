import { InvalidRequestError } from '@atproto/oauth-provider'
import { AtUri, NsidString } from '@atproto/syntax'
import { Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { app, com } from '../../../../lexicons/index.js'
import { computeProxyTo, pipethrough } from '../../../../pipethrough'

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
        collection: feedUrl.collection as NsidString,
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
        lxm: app.bsky.feed.getFeedSkeleton.$lxm,
      })
    },
  })
}
