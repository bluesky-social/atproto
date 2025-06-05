import { Code, ConnectError } from '@connectrpc/connect'
import { Un$Typed } from '@atproto/api'
import { UpstreamFailureError } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { Preferences } from '../../../../lexicon/types/app/bsky/notification/defs'
import { ensurePreferences } from './util'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.notification.getPreferences({
    auth: ctx.authVerifier.standard,
    handler: async ({ auth }) => {
      const actorDid = auth.credentials.iss
      const preferences = await computePreferences(ctx, actorDid)
      return {
        encoding: 'application/json',
        body: {
          preferences,
        },
      }
    },
  })
}

const computePreferences = async (
  ctx: AppContext,
  actorDid: string,
): Promise<Un$Typed<Preferences>> => {
  try {
    const res = await ctx.dataplane.getNotificationPreferences({
      actorDid,
    })
    return ensurePreferences(res)
  } catch (err) {
    if (err instanceof ConnectError && err.code !== Code.NotFound) {
      throw new UpstreamFailureError(
        'cannot get current notification preferences',
        'NotificationPreferencesFailed',
        { cause: err },
      )
    }
  }
  return ensurePreferences({})
}
