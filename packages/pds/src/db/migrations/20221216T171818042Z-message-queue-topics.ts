import { Kysely, sql } from 'kysely'
import { Dialect } from '..'

const messageQueueTable = 'message_queue'
const messageQueueCursorTable = 'message_queue_cursor'

export async function up(db: Kysely<unknown>, dialect: Dialect): Promise<void> {
  const { ref } = db.dynamic

  // Add topic column to messages table, index by topic
  db.schema
    .alterTable(messageQueueTable)
    .addColumn('topic', 'varchar', (col) =>
      col.notNull().defaultTo('__unknown__'),
    )
    .execute()
  db.schema
    .createIndex(`${messageQueueTable}_topic_idx`)
    .column('topic')
    .on(messageQueueTable)
    .execute()

  // Add topic column to cursor table, replace primary key (consumer) with (consumer, topic).
  // Need different strategies for pg versus sqlite
  if (dialect === 'pg') {
    await db.schema
      .alterTable(messageQueueCursorTable)
      .addColumn('topic', 'varchar', (col) => col.notNull().defaultTo('*'))
      .execute()
    await db.schema
      .alterTable(messageQueueCursorTable)
      .dropConstraint(`${messageQueueCursorTable}_pkey`)
      .execute()
    await sql`alter table ${ref(
      messageQueueCursorTable,
    )} add primary key (consumer, topic)`.execute(db)
  } else if (dialect === 'sqlite') {
    // sqlite isn't as malleable as pg, so we have to recreate the table in order to change its primary key
    await db.schema
      .createTable(`${messageQueueCursorTable}_temp`)
      .addColumn('consumer', 'varchar', (col) => col.notNull())
      // New column
      .addColumn('topic', 'varchar', (col) => col.notNull().defaultTo('*'))
      .addColumn('cursor', 'integer', (col) => col.notNull())
      // New pkey
      .addPrimaryKeyConstraint(`${messageQueueCursorTable}_pkey`, [
        'consumer',
        'topic',
      ])
      .execute()
    await sqliteReplaceTable(
      db,
      messageQueueCursorTable,
      `${messageQueueCursorTable}_temp`,
      ['consumer', 'cursor'],
    )
  }
}

export async function down(
  db: Kysely<unknown>,
  dialect: Dialect,
): Promise<void> {
  const { ref } = db.dynamic

  // Remove topic column from cursor table, replace primary key (consumer, topic) with (consumer).
  // Need different strategies for pg versus sqlite
  if (dialect === 'pg') {
    await db.schema
      .alterTable(messageQueueCursorTable)
      .dropConstraint(`${messageQueueCursorTable}_pkey`)
      .execute()
    await db.schema
      .alterTable(messageQueueCursorTable)
      .dropColumn('topic')
      .execute()
    await sql`alter table ${ref(
      messageQueueCursorTable,
    )} add primary key (consumer)`.execute(db)
  } else if (dialect === 'sqlite') {
    // sqlite isn't as malleable as pg, so we have to recreate the table in order to change its primary key
    await db.schema
      .createTable(`${messageQueueCursorTable}_temp`)
      // consumer is pkey, dropped topic column
      .addColumn('consumer', 'varchar', (col) => col.notNull().primaryKey())
      .addColumn('cursor', 'integer', (col) => col.notNull())
      .execute()
    await sqliteReplaceTable(
      db,
      messageQueueCursorTable,
      `${messageQueueCursorTable}_temp`,
      ['consumer', 'cursor'],
    )
  }

  // Remove topic column from messages table, remove index
  db.schema
    .dropIndex(`${messageQueueTable}_topic_idx`)
    .on(messageQueueTable)
    .execute()
  db.schema.alterTable(messageQueueTable).dropColumn('topic').execute()
}

async function sqliteReplaceTable(
  db: Kysely<unknown>,
  orig: string,
  replacement: string,
  columns: string[],
) {
  await (db as Kysely<any>)
    .insertInto(replacement)
    .columns(columns)
    .expression((exp) =>
      exp.selectFrom(messageQueueCursorTable).select(columns),
    )
    .execute()
  await db.schema.dropTable(orig).execute()
  await db.schema.alterTable(replacement).renameTo(orig).execute()
}
