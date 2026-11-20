import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../context.js'
import checkSpacesMigration from './checkSpacesMigration.js'
import completeSpacesMigration from './completeSpacesMigration.js'
import prepareSpacesMigration from './prepareSpacesMigration.js'
import recountSpacesMigration from './recountSpacesMigration.js'
import reserveKemKey from './reserveKemKey.js'

// PDS-internal. All but reserveKemKey exist for the migration into spaces and
// are temporary; entryway signups reserve KEM keys for as long as they last.
export default function (server: Server, ctx: AppContext) {
  checkSpacesMigration(server, ctx)
  // Stats are kept with or without an entryway
  recountSpacesMigration(server, ctx)
  // Without an entryway the PDS's own publisher publishes: nothing else may
  // record a key published, and no one would use a reservation
  if (ctx.cfg.entryway) {
    reserveKemKey(server, ctx)
    prepareSpacesMigration(server, ctx)
    completeSpacesMigration(server, ctx)
  }
}
