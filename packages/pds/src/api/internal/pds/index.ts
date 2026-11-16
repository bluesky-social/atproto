import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../context.js'
import checkSpacesMigration from './checkSpacesMigration.js'
import completeSpacesMigration from './completeSpacesMigration.js'
import prepareSpacesMigration from './prepareSpacesMigration.js'
import reserveKemKey from './reserveKemKey.js'

// PDS-internal and temporary: these exist for the migration into spaces
export default function (server: Server, ctx: AppContext) {
  checkSpacesMigration(server, ctx)
  // Without an entryway the PDS's own publisher publishes: nothing else may
  // record a key published, and no one would use a reservation
  if (ctx.cfg.entryway) {
    reserveKemKey(server, ctx)
    prepareSpacesMigration(server, ctx)
    completeSpacesMigration(server, ctx)
  }
}
