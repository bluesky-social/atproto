import { Kysely } from 'kysely'

const messageQueueTable = 'message_queue'
const messageQueueCursorTable = 'message_queue_cursor'

export async function up(db: Kysely<unknown>): Promise<void> {
  // TODO indexes/sqlite
  db.schema
    .alterTable(messageQueueTable)
    .addColumn('topic', 'varchar', (col) =>
      col.notNull().defaultTo('__unknown__'),
    )
    .execute()
  await db.schema
    .alterTable(messageQueueCursorTable)
    .addColumn('topic', 'varchar', (col) => col.notNull().defaultTo('*'))
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  db.schema.alterTable(messageQueueTable).dropColumn('topic').execute()
  await db.schema
    .alterTable(messageQueueCursorTable)
    .dropColumn('topic')
    .execute()
}
