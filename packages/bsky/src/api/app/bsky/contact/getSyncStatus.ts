import { DatetimeString } from '@atproto/syntax'
import { Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { app } from '../../../../lexicons/index.js'
import { assertRolodexOrThrowUnimplemented, callRolodexClient } from './util'

export default function (server: Server, ctx: AppContext) {
  server.add(app.bsky.contact.getSyncStatus, {
    auth: ctx.authVerifier.standard,
    handler: async ({ auth }) => {
      assertRolodexOrThrowUnimplemented(ctx)

      const actor = auth.credentials.iss
      const res = await callRolodexClient(
        ctx.rolodexClient.getSyncStatus({
          actor,
        }),
      )

      const syncStatus: app.bsky.contact.defs.SyncStatus | undefined =
        res.status && res.status.syncedAt
          ? {
              matchesCount: res.status.matchesCount,
              syncedAt: res.status.syncedAt
                .toDate()
                .toISOString() as DatetimeString,
            }
          : undefined

      return {
        encoding: 'application/json',
        body: {
          syncStatus,
        },
      }
    },
  })
}
