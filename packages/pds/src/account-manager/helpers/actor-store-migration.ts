import { wait } from '@atproto/common'
import type { ActorStore } from '../../actor-store/actor-store'
import { actorStoreMigrationLogger as logger } from '../../logger'
import type { AccountManager } from '../account-manager'

export class ActorStoreMigrator {
  destroyed = false
  running: Promise<void> | null = null

  constructor(
    private accountManager: AccountManager,
    private actorStore: ActorStore,
    private throwOnError: boolean,
  ) {}

  start() {
    const running = this.run().catch((err) => {
      logger.error({ err }, 'ActorStoreMigrator crashed')
      throw err
    })
    void running.catch(() => {})
    this.running = running
  }

  async destroy() {
    this.destroyed = true
    await this.running
  }

  private async run(): Promise<void> {
    while (!(await this.accountManager.allActorStoresMigrated())) {
      if (this.destroyed) return

      const unstuck =
        await this.accountManager.unstickStaleActorStoreMigrations(60_000)
      for (const did of unstuck) {
        logger.warn({ did }, 'Unstuck stale actor store migration')
      }

      const claimed = await this.accountManager.claimNextActorStoreToMigrate()
      if (!claimed) {
        // No work available - either the remaining unmigrated actors are
        // claimed by another process or stuck claims will expire and be
        // unstuck on a later iteration.
        await wait(1000)
        continue
      }

      try {
        const { dbLocation } = await this.actorStore.getLocation(claimed.did)
        // runs in a worker thread so the main event loop stays responsive
        await this.actorStore.runMigration(dbLocation)
        await this.accountManager.markActorStoreMigrationSuccess(claimed.did)
      } catch (e) {
        await this.accountManager.releaseActorStoreMigrationClaim(claimed.did)
        logger.error(
          { did: claimed.did, err: e },
          'Failed to migrate actor store',
        )
        if (this.throwOnError) {
          throw e
        }
        await wait(5000) // avoid tight error loops
      }
    }
  }
}
