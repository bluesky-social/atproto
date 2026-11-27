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
      const signingKey = (await actorStore.keypair(did)).did()
      const live = await inspectKemKey(ctx, did, {
        kem: kemKey,
        signing: signingKey,
      })

      const correct =
        live.published &&
        (await progress.recordedKemKeyState(did)) === 'published'
      // Keeps the time a correctly recorded key was published
      if (!correct) {
        // Clearing kemPublishedAt re-queues the account. Opening a store
        // migrates its schema but not its key: only one holding a key is
        // recorded migrated, or a did:web account could settle without one.
        await progress.recordChecked(did, {
          ...live,
          storeMigrated: storeMigrated && kemKey !== undefined,
        })
      }
      const recordedKemKeyState = await progress.recordedKemKeyState(did)

      return {
        encoding: 'application/json' as const,
        body: {
          did,
          storeMigrated,
          kemKey,
          kemPublished: live.published,
          unpublishableReason: live.unpublishableReason ?? undefined,
          recordedKemKeyState,
        },
      }
    },
  })
}
