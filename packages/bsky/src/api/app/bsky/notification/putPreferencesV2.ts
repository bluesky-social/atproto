import { Code, ConnectError } from '@connectrpc/connect'
import { Un$Typed } from '@atproto/api'
import { UpstreamFailureError } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { Preferences } from '../../../../lexicon/types/app/bsky/notification/defs'
import { HandlerInput } from '../../../../lexicon/types/app/bsky/notification/putPreferencesV2'
import { ensurePreferences } from './util'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.notification.putPreferencesV2({
    auth: ctx.authVerifier.standard,
    handler: async ({ auth, input }) => {
      const actorDid = auth.credentials.iss
      const { preferences, exists } = await computePreferences(
        ctx,
        actorDid,
        input,
      )

      // @TODO: lexicon validation?
      const namespace = 'app.bsky.notification.defs#preferences'
      const key = 'self'

      const stashInput = {
        actorDid,
        namespace,
        key,
        payload: preferences,
      }

      if (exists) {
        await ctx.stashClient.update(stashInput)
      } else {
        await ctx.stashClient.create(stashInput)
      }

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
  input: HandlerInput,
): Promise<{ preferences: Un$Typed<Preferences>; exists: boolean }> => {
  let preferences: Preferences
  let exists = false
  try {
    const res = await ctx.dataplane.getNotificationPreferences({
      actorDid,
    })
    const currentPreferences = ensurePreferences(res)
    preferences = { ...currentPreferences, ...input.body }
    exists = true
  } catch (err) {
    if (err instanceof ConnectError && err.code !== Code.NotFound) {
      throw new UpstreamFailureError(
        'cannot get current notification preferences',
      )
    }
    preferences = ensurePreferences({
      ...input.body,
    })
  }
  delete preferences.$type
  return { preferences, exists }
}
