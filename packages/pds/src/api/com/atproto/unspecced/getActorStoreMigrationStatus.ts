import {
  allActorStoresMigrated,
  countInProgressMigrations,
  getVersionCounts,
} from '../../../../account-manager/helpers/actor-store-migration'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.unspecced.getActorStoreMigrationStatus({
    auth: ctx.authVerifier.adminToken,
    handler: async () => {
      const [allMigrated, inProgressCount, versionCounts] = await Promise.all([
        allActorStoresMigrated(ctx.accountManager.db),
        countInProgressMigrations(ctx.accountManager.db),
        getVersionCounts(ctx.accountManager.db), // Note: This is a relatively expensive query
      ])
      return {
        encoding: 'application/json',
        body: { allMigrated, inProgressCount, versionCounts },
      }
    },
  })
}
