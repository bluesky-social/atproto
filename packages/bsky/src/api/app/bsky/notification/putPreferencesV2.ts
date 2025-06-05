import { Un$Typed } from '@atproto/api'
import { InternalServerError, UpstreamFailureError } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { Preferences } from '../../../../lexicon/types/app/bsky/notification/defs'
import { HandlerInput } from '../../../../lexicon/types/app/bsky/notification/putPreferencesV2'
import { GetNotificationPreferencesResponse } from '../../../../proto/bsky_pb'
import { protobufToLex } from './util'

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
  let res: GetNotificationPreferencesResponse
  try {
    res = await ctx.dataplane.getNotificationPreferences({
      dids: [actorDid],
    })
  } catch (err) {
    throw new UpstreamFailureError(
      'cannot get current notification preferences',
      'NotificationPreferencesFailed',
      { cause: err },
    )
  }

  if (res.preferences.length !== 1) {
    throw new InternalServerError(
      `expected exactly one preferences entry, got ${res.preferences.length}`,
      'NotificationPreferencesWrongResult',
    )
  }

  const exists = Object.values(res.preferences[0]).some((v) => v !== undefined)
  const currentPreferences = protobufToLex(res.preferences[0])
  const preferences = { ...currentPreferences, ...input.body }
  return { preferences, exists }
}
