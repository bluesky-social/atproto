import { Kysely } from 'kysely'
import { Dialect } from '..'

export async function up(db: Kysely<unknown>, dialect: Dialect): Promise<void> {
  const jsonType = dialect === 'pg' ? 'jsonb' : 'varchar'
  await db.schema.alterTable('post').addColumn('langs', jsonType).execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('post').dropColumn('langs').execute()
}
