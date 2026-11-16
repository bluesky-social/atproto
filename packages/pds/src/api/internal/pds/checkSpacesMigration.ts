import { InvalidRequestError, type Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../context.js'
import { internal } from '../../../lexicons/index.js'
import { inspectKemKey } from '../../../spaces-migration/publish.js'

/**
 * An operator tool: nothing re-checks published accounts automatically. It
 * corrects the record from the live state, but never writes to PLC and never
 * sequences.
 */
export default function (server: Server, ctx: AppContext) {
  server.add(internal.pds.checkSpacesMigration, {
    // Without an entryway this is plain admin token auth
    auth: ctx.authVerifier.adminTokenOrEntrywayService,
    handler: async ({ input }) => {
      const { did } = input.body
      const { actorStore } = ctx
      const { progress } = ctx.spacesMigration
      if (!(await actorStore.exists(did))) {
        throw new InvalidRequestError('Repo not found', 'NotFound')
      }
      const storeMigrated = await actorStore.isMigrated(did)
      const kemKey = (await actorStore.kemKeypair(did))?.did()
      const live = await inspectKemKey(ctx, did, kemKey)

      const recorded = await progress.get(did)
      const correct =
        live.published &&
        !!recorded?.kemPublishedAt &&
        recorded.unpublishableReason === null
      // Keeps the time a correctly recorded key was published
      if (!correct) {
        // Clearing kemPublishedAt re-queues the account
        await progress.recordChecked(did, live)
      }
      const corrected = await progress.get(did)

      return {
        encoding: 'application/json' as const,
        body: {
          did,
          storeMigrated,
          kemKey,
          kemPublished: live.published,
          unpublishableReason: live.unpublishableReason ?? undefined,
          recordedPublishedAt: corrected?.kemPublishedAt ?? undefined,
        },
      }
    },
  })
}
