import { getNotif } from '@atproto/identity'
import { InvalidRequestError, proxy } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { getDidDoc } from '../util/resolver'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.notification.registerPush({
    auth: ctx.authVerifier.access,
    handler: async (request) => {
      const { auth, input } = request
      const { serviceDid } = input.body
      const {
        credentials: { did },
      } = auth

      const authHeaders = await ctx.serviceAuthHeaders(did, serviceDid)

      if (ctx.cfg.bskyAppView.did === serviceDid) {
        return proxy(request, ctx.appViewAgent.service.href, authHeaders)
      } else {
        const notifEndpoint = await getEndpoint(ctx, serviceDid)
        return proxy(request, notifEndpoint, authHeaders)
      }
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
