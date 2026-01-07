import { Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { SyncStatus } from '../../../../lexicon/types/app/bsky/contact/defs'
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

      let syncStatus: SyncStatus | undefined
      if (res.status && res.status.syncedAt) {
        const syncedAt = res.status?.syncedAt?.toDate().toISOString()
        syncStatus = {
          matchesCount: res.status.matchesCount,
          syncedAt,
        }
      }

      return {
        encoding: 'application/json',
        body: {
          syncStatus,
        },
      }
    },
  })
}
