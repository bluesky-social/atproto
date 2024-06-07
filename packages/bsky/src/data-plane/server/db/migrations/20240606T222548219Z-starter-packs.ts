import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('starter_pack')
    .addColumn('uri', 'varchar', (col) => col.primaryKey())
    .addColumn('cid', 'varchar', (col) => col.notNull())
    .addColumn('creator', 'varchar', (col) => col.notNull())
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .addColumn('indexedAt', 'varchar', (col) => col.notNull())
    .addColumn('sortAt', 'varchar', (col) =>
      col
        .generatedAlwaysAs(sql`least("createdAt", "indexedAt")`)
        .stored()
        .notNull(),
    )
    .execute()
  await db.schema
    .createIndex('starter_pack_creator_order_by_idx')
    .on('starter_pack')
    .columns(['creator', 'sortAt', 'cid'])
    .execute()
  await db.schema
    .alterTable('profile')
    .addColumn('joinedViaStarterPackUri', 'varchar')
    .execute()
  await db.schema
    .alterTable('profile')
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .execute()
  await db.schema
    .createIndex('profile_starter_pack_joined_idx')
    .on('profile')
    .columns(['joinedViaStarterPackUri', 'createdAt'])
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('starter_pack').execute()
  await db.schema
    .alterTable('profile')
    .dropColumn('joinedViaStarterPackUri')
    .execute()
  await db.schema.alterTable('profile').dropColumn('createdAt').execute()
}
