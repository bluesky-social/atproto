import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { getNotif } from '@atproto/identity'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { AtpClient } from '@atproto/api'
import { getDidDoc } from '../util/resolver'

export default function (server: Server, ctx: AppContext) {
  const { appViewApi } = ctx
  if (!appViewApi) return
  server.app.bsky.notification.registerPush({
    auth: ctx.authVerifier.accessDeactived,
    handler: async ({ auth, input }) => {
      const { serviceDid } = input.body
      const {
        credentials: { did },
      } = auth

      const authHeaders = await ctx.serviceAuthHeaders(did, serviceDid)

      if (ctx.cfg.bskyAppView?.did === serviceDid) {
        await appViewApi.app.bsky.notification.registerPush(input.body, {
          ...authHeaders,
          encoding: 'application/json',
        })
        return
      }

      const notifEndpoint = await getEndpoint(ctx, serviceDid)
      const api = new AtpClient(notifEndpoint)
      await api.app.bsky.notification.registerPush(input.body, {
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
