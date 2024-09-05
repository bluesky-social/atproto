import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('actor_sync').dropColumn('commitDataCid').execute()
  await db.schema.alterTable('actor_sync').dropColumn('rebaseCount').execute()
  await db.schema.alterTable('actor_sync').dropColumn('tooBigCount').execute()
  // Migration code
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('actor_sync')
    .addColumn('commitDataCid', 'varchar', (col) => col.notNull())
    .execute()
  await db.schema
    .alterTable('actor_sync')
    .addColumn('rebaseCount', 'integer', (col) => col.notNull())
    .execute()
  await db.schema
    .alterTable('actor_sync')
    .addColumn('tooBigCount', 'integer', (col) => col.notNull())
    .execute()
}
