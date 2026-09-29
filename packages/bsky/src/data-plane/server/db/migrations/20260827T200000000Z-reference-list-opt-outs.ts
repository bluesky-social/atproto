import { type Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('reference_list_opt_out')
    .addColumn('uri', 'varchar', (col) => col.primaryKey())
    .addColumn('cid', 'varchar', (col) => col.notNull())
    .addColumn('creator', 'varchar', (col) => col.notNull())
    .addColumn('subjectUri', 'varchar', (col) => col.notNull())
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .addColumn('indexedAt', 'varchar', (col) => col.notNull())
    .addColumn('sortAt', 'varchar', (col) =>
      col
        .generatedAlwaysAs(sql`least("createdAt", "indexedAt")`)
        .stored()
        .notNull(),
    )
    .addUniqueConstraint('reference_list_opt_out_unique_subject', [
      'creator',
      'subjectUri',
    ])
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('reference_list_opt_out').execute()
}
