import { sql } from 'kysely'
import { Database } from './index'

const getEnv = () => ({
  DB_URL:
    process.env.OZONE_DB_URL ||
    'postgresql://pg:password@127.0.0.1:5433/postgres',
  DB_SCHEMA: process.env.OZONE_DB_SCHEMA || 'ozone',
})

export async function MigrateOzoneNamespace() {
  const env = getEnv()
  const db = new Database({
    url: env.DB_URL,
    schema: env.DB_SCHEMA,
  })

  await db.db.updateTable('moderation_event').set({
    action: sql`REPLACE(action, 'com.atproto.admin.defs', 'tools.ozone.defs')`,
  })
}
