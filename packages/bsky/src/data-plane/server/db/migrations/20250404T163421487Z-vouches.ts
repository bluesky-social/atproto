import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('vouch')
    .addColumn('uri', 'varchar', (col) => col.notNull())
    .addColumn('subject', 'varchar', (col) => col.notNull())
    .addPrimaryKeyConstraint('pk_vouch', ['uri', 'subject'])
    .addColumn('handle', 'varchar', (col) => col.notNull())
    .addColumn('displayName', 'varchar', (col) => col.notNull())
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
    .createIndex('vouch_uri_cursor_idx')
    .on('vouch')
    .columns(['uri', 'sortAt'])
    .execute()
  await db.schema
    .createIndex('vouch_subject_cursor_idx')
    .on('vouch')
    .columns(['subject', 'sortAt'])
    .execute()

  await db.schema
    .alterTable('actor')
    .addColumn('trustedVoucher', 'boolean')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('vouch').execute()
}
