import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('post_agg')
    .addColumn('quoteCount', 'bigint', (col) => col.notNull().defaultTo(0))
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('post_agg').dropColumn('quoteCount').execute()
}
