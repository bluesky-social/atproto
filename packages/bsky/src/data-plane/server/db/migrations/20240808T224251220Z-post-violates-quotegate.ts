import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('post')
    .addColumn('violatesQuoteGate', 'boolean')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('post').dropColumn('violatesQuoteGate').execute()
}
