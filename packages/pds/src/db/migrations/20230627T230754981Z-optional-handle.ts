import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('did_handle')
    .alterColumn('handle')
    .dropNotNull()
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('did_handle')
    .alterColumn('handle')
    .setNotNull()
    .execute()
}
