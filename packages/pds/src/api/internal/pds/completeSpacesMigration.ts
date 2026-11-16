import { InvalidRequestError, type Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../context.js'
import { internal } from '../../../lexicons/index.js'
import { inspectKemKey } from '../../../spaces-migration/publish.js'

export default function (server: Server, ctx: AppContext) {
  server.add(internal.pds.completeSpacesMigration, {
    auth: ctx.authVerifier.adminTokenOrEntrywayService,
    handler: async ({ input }) => {
      const { did } = input.body
      if (!(await ctx.actorStore.exists(did))) {
        throw new InvalidRequestError('Repo not found', 'NotFound')
      }
      const kemKey = (await ctx.actorStore.kemKeypair(did))?.did()
      const live = await inspectKemKey(ctx, did, kemKey)
      if (!live.published) {
        throw new InvalidRequestError(
          'KEM key not published',
          'KemKeyNotPublished',
        )
      }
      await ctx.sequencer.sequenceIdentity(did)
      // The caller holds no lease, so this is recorded as a check
      await ctx.spacesMigration.progress.recordChecked(did, {
        published: true,
        unpublishableReason: null,
      })
      return {
        encoding: 'application/json' as const,
        body: {},
      }
    },
  })
}
