import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('post_entity').renameTo('post_facet').execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('post_facet').renameTo('post_entity').execute()
}
