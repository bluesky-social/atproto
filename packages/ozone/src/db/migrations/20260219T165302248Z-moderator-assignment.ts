import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('moderator_assignment')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    // assignee
    .addColumn('did', 'text', (col) => col.notNull())
    // assigned over
    .addColumn('reportId', 'integer')
    .addColumn('queueId', 'integer')
    // validity
    .addColumn('startAt', 'timestamptz', (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .addColumn('endAt', 'timestamptz', (col) => col.notNull())
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('moderator_assignment').ifExists().execute()
}
