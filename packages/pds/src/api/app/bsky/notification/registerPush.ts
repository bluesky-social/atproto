import { getNotif } from '@atproto/identity'
import { Client } from '@atproto/lex'
import { InvalidRequestError, Server } from '@atproto/xrpc-server'
import { AuthScope } from '../../../../auth-scope'
import { AppContext } from '../../../../context'
import { app } from '../../../../lexicons/index.js'
import { getDidDoc } from '../util/resolver'

export default function (server: Server, ctx: AppContext) {
  const { bskyAppView } = ctx
  if (!bskyAppView) return

  server.add(app.bsky.notification.registerPush, {
    auth: ctx.authVerifier.authorization({
      additional: [AuthScope.SignupQueued],
      authorize: () => {
        // @NOTE this endpoint predates generic service proxying but we want to
        // map the permission to the "RPC" scope for consistency. However, since
        // the service info is only available in the request body, we can't
        // assert permissions here.
      },
    }),
    handler: async ({ auth, input }) => {
      const { serviceDid } = input.body
      const { did } = auth.credentials

      if (auth.credentials.type === 'oauth') {
        auth.credentials.permissions.assertRpc({
          aud: `${serviceDid}#bsky_notif`,
          lxm: app.bsky.notification.registerPush.$lxm,
        })
      }

      const { headers } = await ctx.serviceAuthHeaders(
        did,
        serviceDid,
        app.bsky.notification.registerPush.$lxm,
      )

      if (bskyAppView.did === serviceDid) {
        await bskyAppView.client.call(
          app.bsky.notification.registerPush,
          input.body,
          { headers },
        )
        return
      }

      const notifEndpoint = await getEndpoint(ctx, serviceDid)
      const client = new Client({ service: notifEndpoint })
      await client.call(app.bsky.notification.registerPush, input.body, {
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
