import { type Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('space_writer')
    .addColumn('removedAt', 'varchar')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  // Without the column, a removed writer would read as a current one.
  await sql`delete from space_writer where removedAt is not null`.execute(db)
  await db.schema.alterTable('space_writer').dropColumn('removedAt').execute()
}
