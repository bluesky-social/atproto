import { LATEST_STORE_SCHEMA_VERSION } from '../../actor-store/db/migrations'
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
