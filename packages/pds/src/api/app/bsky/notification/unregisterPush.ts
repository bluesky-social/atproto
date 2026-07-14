import { getNotif } from '@atproto/identity'
import { xrpc } from '@atproto/lex'
import { InvalidRequestError, type Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import { app } from '../../../../lexicons/index.js'
import { getDidDoc } from '../util/resolver.js'

export default function (server: Server, ctx: AppContext) {
  const { bskyAppView } = ctx
  if (!bskyAppView) return

  server.add(app.bsky.notification.unregisterPush, {
    auth: ctx.authVerifier.authorization({
      additional: [],
      authorize: () => {},
    }),
    handler: async ({ auth, input: { body } }) => {
      const { serviceDid } = body
      const { did } = auth.credentials

      if (auth.credentials.type === 'oauth') {
        auth.credentials.permissions.assertRpc({
          aud: `${serviceDid}#bsky_notif`,
          lxm: app.bsky.notification.unregisterPush.$lxm,
        })
      }

      const { headers } = await ctx.serviceAuthHeaders(
        did,
        serviceDid,
        app.bsky.notification.unregisterPush.$lxm,
      )

      if (bskyAppView.did === serviceDid) {
        await bskyAppView.client.call(
          app.bsky.notification.unregisterPush,
          body,
          { headers },
        )
        return
      }

      const notifEndpoint = await getEndpoint(ctx, serviceDid)

      await xrpc(notifEndpoint, app.bsky.notification.unregisterPush, {
        validateRequest: ctx.cfg.service.devMode,
        validateResponse: ctx.cfg.service.devMode,
        strictResponseProcessing: ctx.cfg.service.devMode,
        body,
        headers,
      })
    },
  })
}

const getEndpoint = async (ctx: AppContext, serviceDid: string) => {
  const doc = await getDidDoc(ctx, serviceDid)
  const notifEndpoint = getNotif(doc)
  if (!notifEndpoint) {
    throw new InvalidRequestError(
      `invalid notification service details in did document: ${serviceDid}`,
    )
  }
  return notifEndpoint
}
