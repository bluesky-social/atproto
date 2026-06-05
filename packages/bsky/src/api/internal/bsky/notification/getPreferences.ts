import { Un$Typed } from '@atproto/lex'
import { Server, UpstreamFailureError } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context.js'
import { internal } from '../../../../lexicons/index.js'
import { GetNotificationPreferencesResponse } from '../../../../proto/bsky_pb.js'
import { protobufToLex } from '../../../app/bsky/notification/util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(internal.bsky.notification.getPreferences, {
    auth: ctx.authVerifier.role,
    handler: async ({ params }) => {
      const { dids } = params

      let res: GetNotificationPreferencesResponse
      try {
        res = await ctx.dataplane.getNotificationPreferences({ dids })
      } catch (err) {
        throw new UpstreamFailureError(
          'cannot get notification preferences',
          'NotificationPreferencesFailed',
          { cause: err },
        )
      }

      const preferences: Un$Typed<internal.bsky.notification.getPreferences.PreferencesByDid>[] =
        []
      dids.forEach((did, i) => {
        const protoPreferences = res.preferences[i]
        // The dataplane returns an entry for every requested DID, positionally.
        // An empty `entry` means the account has no stored preferences, in which
        // case we omit it from the (non-positional) response.
        // This is for extra-safety, but it shouldn't happen.
        if (!protoPreferences || protoPreferences.entry.length === 0) {
          return
        }
        preferences.push({
          did,
          preferences: protobufToLex(protoPreferences),
        })
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
