import { Server } from '../../../../../lexicon'
import AppContext from '../../../../../context'
import { getNotif } from '@atproto/identity'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { AtpAgent } from '@atproto/api'
import { getDidDoc } from '../util/resolver'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.notification.registerPush({
    auth: ctx.accessVerifier,
    handler: async ({ auth, params }) => {
      const { serviceDid } = params
      const {
        credentials: { did },
      } = auth

      const { appviewAgent } = ctx

      if (ctx.canProxyWrite() && ctx.cfg.bskyAppViewDid === serviceDid) {
        await appviewAgent.api.app.bsky.notification.registerPush(
          params,
          await ctx.serviceAuthHeaders(did, serviceDid),
        )
        return
      }

      const notifEndpoint = await getEndpoint(ctx, serviceDid)
      const agent = new AtpAgent({ service: notifEndpoint })
      await agent.api.app.bsky.notification.registerPush(
        params,
        await ctx.serviceAuthHeaders(did, serviceDid),
      )
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
