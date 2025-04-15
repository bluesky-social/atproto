import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('verification')
    .addColumn('uri', 'varchar', (col) => col.notNull())
    .addColumn('cid', 'varchar', (col) => col.notNull())
    .addColumn('rkey', 'varchar', (col) => col.notNull())
    .addColumn('actor', 'varchar', (col) => col.notNull())
    .addColumn('subject', 'varchar', (col) => col.notNull())
    .addPrimaryKeyConstraint('pk_verification', ['uri', 'subject'])
    .addColumn('handle', 'varchar', (col) => col.notNull())
    .addColumn('displayName', 'varchar', (col) => col.notNull())
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .addColumn('indexedAt', 'varchar', (col) => col.notNull())
    .addColumn('sortedAt', 'varchar', (col) =>
      col
        .generatedAlwaysAs(sql`least("createdAt", "indexedAt")`)
        .stored()
        .notNull(),
    )
    .execute()
  await db.schema
    .createIndex('verification_uri_cursor_idx')
    .on('verification')
    .columns(['uri', 'sortedAt'])
    .execute()
  await db.schema
    .createIndex('verification_actor_cursor_idx')
    .on('verification')
    .columns(['actor', 'sortedAt'])
    .execute()
  await db.schema
    .createIndex('verification_subject_cursor_idx')
    .on('verification')
    .columns(['subject', 'sortedAt'])
    .execute()

  await db.schema
    .alterTable('actor')
    .addColumn('trustedVerifier', 'boolean', (col) =>
      col.notNull().defaultTo(false),
    )
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('verification').execute()
}
