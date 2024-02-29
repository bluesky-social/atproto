import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('post').addColumn('langs', 'jsonb').execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('post').dropColumn('langs').execute()
}
