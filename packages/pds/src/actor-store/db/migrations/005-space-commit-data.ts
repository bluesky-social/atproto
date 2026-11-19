import type { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('space_writer')
    .renameColumn('hash', 'data')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('space_writer')
    .renameColumn('data', 'hash')
    .execute()
}
