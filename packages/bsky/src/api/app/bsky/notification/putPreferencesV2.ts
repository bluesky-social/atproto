import assert from 'node:assert'
import { Un$Typed } from '@atproto/api'
import { UpstreamFailureError } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { Preferences } from '../../../../lexicon/types/app/bsky/notification/defs'
import { HandlerInput } from '../../../../lexicon/types/app/bsky/notification/putPreferencesV2'
import { GetNotificationPreferencesResponse } from '../../../../proto/bsky_pb'
import { Namespaces } from '../../../../stash'
import { protobufToLex } from './util'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.notification.putPreferencesV2({
    auth: ctx.authVerifier.standard,
    handler: async ({ auth, input }) => {
      const actorDid = auth.credentials.iss
      const preferences = await computePreferences(ctx, actorDid, input)

      // Notification preferences are created automatically on the dataplane on signup, so we just update.
      await ctx.stashClient.update({
        actorDid,
        namespace: Namespaces.AppBskyNotificationDefsPreferences,
        key: 'self',
        payload: preferences,
      })

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
): Promise<Un$Typed<Preferences>> => {
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

  assert(
    res.preferences.length === 1,
    `expected exactly one preferences entry, got ${res.preferences.length}`,
  )

  const currentPreferences = protobufToLex(res.preferences[0])
  const preferences = { ...currentPreferences, ...input.body }
  return preferences
}
