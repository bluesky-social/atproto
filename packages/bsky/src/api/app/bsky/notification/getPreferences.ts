import assert from 'node:assert'
import { Un$Typed } from '@atproto/api'
import { Server, UpstreamFailureError } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { Preferences } from '../../../../lexicon/types/app/bsky/notification/defs'
import { app } from '../../../../lexicons/index.js'
import { GetNotificationPreferencesResponse } from '../../../../proto/bsky_pb'
import { protobufToLex } from './util'

export default function (server: Server, ctx: AppContext) {
  server.add(app.bsky.notification.getPreferences, {
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
  return currentPreferences
}
