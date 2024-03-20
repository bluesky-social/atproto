import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('actor')
    .alterColumn('handle')
    .dropNotNull()
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('actor')
    .alterColumn('handle')
    .setNotNull()
    .execute()
}
