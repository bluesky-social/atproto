import { Kysely } from 'kysely'
import { Dialect } from '..'

const messageQueueTable = 'message_queue'
const messageQueueCursorTable = 'message_queue_cursor'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable(messageQueueCursorTable).execute()
  await db.schema.dropTable(messageQueueTable).execute()
}

export async function down(
  db: Kysely<unknown>,
  dialect: Dialect,
): Promise<void> {
  let mqBuilder = db.schema.createTable(messageQueueTable)
  mqBuilder =
    dialect === 'pg'
      ? mqBuilder.addColumn('id', 'serial', (col) => col.primaryKey())
      : mqBuilder.addColumn('id', 'integer', (col) =>
          col.autoIncrement().primaryKey(),
        )
  mqBuilder
    .addColumn('message', 'varchar', (col) => col.notNull())
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .execute()
  await db.schema
    .createTable(messageQueueCursorTable)
    .addColumn('consumer', 'varchar', (col) => col.primaryKey())
    .addColumn('cursor', 'integer', (col) => col.notNull())
    .execute()
}
