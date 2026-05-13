import { Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../context'
import { internal } from '../../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(internal.pds.getActorStoreMigrationStatus, {
    auth: ctx.authVerifier.adminToken,
    handler: async () => {
      const [allMigrated, versionCounts] = await Promise.all([
        ctx.accountManager.allActorStoresMigrated(),
        ctx.accountManager.getActorStoreVersionCounts(),
      ])
      return {
        encoding: 'application/json',
        body: { allMigrated, versionCounts },
      }
    },
  })
}
