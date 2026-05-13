import { Server } from '@atproto/xrpc-server'
import {
  allActorStoresMigrated,
  getVersionCounts,
} from '../../../account-manager/helpers/actor-store-migration'
import { AppContext } from '../../../context'
import { internal } from '../../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(internal.pds.getActorStoreMigrationStatus, {
    auth: ctx.authVerifier.adminToken,
    handler: async () => {
      const [allMigrated, versionCounts] = await Promise.all([
        allActorStoresMigrated(ctx.accountManager.db),
        getVersionCounts(ctx.accountManager.db), // Note: This is a relatively expensive query
      ])
      return {
        encoding: 'application/json',
        body: { allMigrated, versionCounts },
      }
    },
  })
}
