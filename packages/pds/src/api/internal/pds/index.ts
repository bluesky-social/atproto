import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../context.js'
import checkSpacesMigration from './checkSpacesMigration.js'
import completeSpacesMigration from './completeSpacesMigration.js'
import prepareSpacesMigration from './prepareSpacesMigration.js'
import recountSpacesMigration from './recountSpacesMigration.js'

// PDS-internal and temporary: they exist for the migration into spaces
export default function (server: Server, ctx: AppContext) {
  checkSpacesMigration(server, ctx)
  // Stats are kept with or without an entryway
  recountSpacesMigration(server, ctx)
  // Without an entryway the PDS's own publisher publishes: nothing else may
  // record a key published
  if (ctx.cfg.entryway) {
    prepareSpacesMigration(server, ctx)
    completeSpacesMigration(server, ctx)
  }
}
