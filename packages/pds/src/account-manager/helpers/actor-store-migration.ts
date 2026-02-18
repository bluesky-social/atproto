import { sql } from 'kysely'
import { wait } from '@atproto/common'
import { ActorStore } from '../../actor-store/actor-store'
import { LATEST_STORE_SCHEMA_VERSION } from '../../actor-store/db/migrations'
import { actorStoreMigrationLogger as logger } from '../../logger'
import { AccountDb } from '../db'

export const allActorStoresMigrated = async (
  db: AccountDb,
): Promise<boolean> => {
  const unmigrated = await db.db
    .selectFrom('actor')
    .select('did')
    .where('storeSchemaVersion', '<', LATEST_STORE_SCHEMA_VERSION)
    .limit(1)
    .executeTakeFirst()
  return !unmigrated
}

export const migrateAllActorStores = async (
  db: AccountDb,
  actorStore: ActorStore,
  throwOnError: boolean,
): Promise<void> => {
  while (!(await allActorStoresMigrated(db))) {
    const now = new Date().toISOString()
    const claimed = await db.db
      .updateTable('actor')
      .set({ storeIsMigrating: 1, storeMigratedAt: now })
      .where(
        'did',
        '=',
        sql`(SELECT did FROM actor WHERE "storeSchemaVersion" < ${LATEST_STORE_SCHEMA_VERSION} AND "storeIsMigrating" = 0 LIMIT 1)`,
      )
      .where('storeIsMigrating', '=', 0)
      .returning('did')
      .executeTakeFirst()
    if (!claimed) {
      // There may be no work left to claim, but active tasks remaining.
      // Either the other tasks are stuck and will eventually time out, or a concurrent process is actively working on them.
      await wait(1000)
      continue
    }
    try {
      // auto-migrates to latest on open, updating account db appropriately on success/failure
      const actorDb = await actorStore.openDb(claimed.did)
      actorDb.close()
    } catch (e) {
      logger.error(
        { did: claimed.did, err: e },
        'Failed to migrate actor store',
      )
      if (throwOnError) {
        throw e
      }
    }
  }
}
