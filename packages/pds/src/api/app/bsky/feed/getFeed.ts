import { getPdsEndpoint } from '@atproto/common'
import { isDidString } from '@atproto/lex-schema'
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

      // The AppView is used as a cache here: when it cannot answer, the record
      // is fetched from its repo's PDS
      const data = await bskyAppView.client
        .call(com.atproto.repo.getRecord, {
          repo: feedUrl.host,
          collection: feedUrl.collectionSafe,
          rkey: feedUrl.rkeySafe,
        })
        .catch(async () => {
          const did = isDidString(feedUrl.host)
            ? feedUrl.host
            : await ctx.idResolver.handle.resolve(feedUrl.host)
          const didDoc = did && (await ctx.idResolver.did.resolve(did))
          const pds = didDoc && getPdsEndpoint(didDoc)
          if (!isDidString(did) || !pds) {
            throw new InvalidRequestError(
              'could not resolve feed did',
              'UnknownFeed',
            )
          }
          return ctx.safeClient(pds).call(com.atproto.repo.getRecord, {
            repo: did,
            collection: feedUrl.collectionSafe,
            rkey: feedUrl.rkeySafe,
          })
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
