import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../context.js'
import { internal } from '../../../lexicons/index.js'

/**
 * An operator tool for stats that drifted, as reported by the
 * `spaces_migration.stats_drift` metric. A dry run unless `fix` is set.
 */
export default function (server: Server, ctx: AppContext) {
  server.add(internal.pds.recountSpacesMigration, {
    auth: ctx.authVerifier.adminToken,
    handler: async ({ input }) => {
      const result = await ctx.spacesMigration.progress.recountStats({
        fix: input.body.fix ?? false,
      })
      return {
        encoding: 'application/json' as const,
        body: result,
      }
    },
  })
}
