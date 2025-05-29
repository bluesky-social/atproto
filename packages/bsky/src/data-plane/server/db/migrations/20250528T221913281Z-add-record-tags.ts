import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('record').addColumn('tags', 'jsonb').execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('record').dropColumn('tags').execute()
}
