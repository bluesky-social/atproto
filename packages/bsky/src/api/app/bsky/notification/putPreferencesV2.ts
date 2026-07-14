import assert from 'node:assert'
import type { Un$Typed } from '@atproto/lex'
import { type Server, UpstreamFailureError } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import { app } from '../../../../lexicons/index.js'
import type { GetNotificationPreferencesResponse } from '../../../../proto/bsky_pb.js'
import { Namespaces } from '../../../../stash.js'
import { DEFAULT_CHAT_PREFERENCE, protobufToLex } from './util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(app.bsky.notification.putPreferencesV2, {
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
  input: app.bsky.notification.putPreferencesV2.$Input,
): Promise<Un$Typed<app.bsky.notification.defs.Preferences>> => {
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
  // NOTE: See the deprecation notice on the lexicon. This field returns a static default value and shouldn't be used.
  // Use the chat.bsky.notification.defs#preferences type instead.
  preferences.chat = DEFAULT_CHAT_PREFERENCE
  return preferences
}
