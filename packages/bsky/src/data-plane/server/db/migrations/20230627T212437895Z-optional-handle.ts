import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('actor')
    .alterColumn('handle', (col) => col.dropNotNull())
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('actor')
    .alterColumn('handle', (col) => col.setNotNull())
    .execute()
}
