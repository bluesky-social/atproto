import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { getNotif } from '@atproto/identity'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { AtpAgent } from '@atproto/api'
import { getDidDoc } from '../util/resolver'
import { AuthScope } from '../../../../auth-verifier'
import { ids } from '../../../../lexicon/lexicons'

export default function (server: Server, ctx: AppContext) {
  const { appViewAgent } = ctx
  if (!appViewAgent) return
  server.app.bsky.notification.registerPush({
    auth: ctx.authVerifier.accessStandard({
      additional: [AuthScope.SignupQueued],
    }),
    handler: async ({ auth, input }) => {
      const { serviceDid } = input.body
      const {
        credentials: { did },
      } = auth

      const authHeaders = await ctx.serviceAuthHeaders(
        did,
        serviceDid,
        ids.AppBskyNotificationRegisterPush,
      )

      if (ctx.cfg.bskyAppView?.did === serviceDid) {
        await appViewAgent.api.app.bsky.notification.registerPush(input.body, {
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
