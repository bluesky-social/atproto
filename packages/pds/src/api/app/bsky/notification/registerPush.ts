import { AtpAgent } from '@atproto/api'
import { getNotif } from '@atproto/identity'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { ids } from '../../../../lexicon/lexicons'
import { getDidDoc } from '../util/resolver'

export default function (server: Server, ctx: AppContext) {
  const { bskyAppView } = ctx
  if (!bskyAppView) return

  const aud = `${bskyAppView.did}#bsky_appview`

  server.app.bsky.notification.registerPush({
    auth: ctx.authVerifier.authorization({
      authorize: ({ permissions }) => {
        permissions.assertRpc({ aud, lxm: ids.AppBskyNotificationRegisterPush })
      },
    }),
    handler: async ({ auth, input }) => {
      const { serviceDid } = input.body
      const { did } = auth.credentials

      const authHeaders = await ctx.serviceAuthHeaders(
        did,
        serviceDid,
        ids.AppBskyNotificationRegisterPush,
      )

      if (bskyAppView.did === serviceDid) {
        await bskyAppView.agent.app.bsky.notification.registerPush(input.body, {
          ...authHeaders,
          encoding: 'application/json',
        })
        return
      }

      const notifEndpoint = await getEndpoint(ctx, serviceDid)
      const agent = new AtpAgent({ service: notifEndpoint })
      await agent.api.app.bsky.notification.registerPush(input.body, {
        ...authHeaders,
        encoding: 'application/json',
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
