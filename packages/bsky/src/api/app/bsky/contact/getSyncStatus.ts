import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { SyncStatus } from '../../../../lexicon/types/app/bsky/contact/defs'
import { assertRolodexOrThrowUnimplemented } from './util'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.contact.getSyncStatus({
    auth: ctx.authVerifier.standard,
    handler: async ({ auth }) => {
      assertRolodexOrThrowUnimplemented(ctx)

      const actor = auth.credentials.iss
      // TODO: Error handling.
      const res = await ctx.rolodexClient.getSyncStatus({
        actor,
      })

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
