import { Kysely, sql } from 'kysely'
import { Dialect } from '..'

export async function up(db: Kysely<any>, dialect: Dialect): Promise<void> {
  if (dialect === 'sqlite') {
    await db.schema.dropTable('repo_seq').execute()
    await db.schema
      .createTable('repo_event')
      .addColumn('id', 'integer', (col) => col.autoIncrement().primaryKey())
      .addColumn('did', 'varchar', (col) => col.notNull())
      .addColumn('eventType', 'varchar', (col) => col.notNull())
      .addColumn('event', sql`blob`, (col) => col.notNull())
      .addColumn('invalidated', 'int2', (col) => col.notNull().defaultTo(0))
      .addColumn('sequencedAt', 'varchar', (col) => col.notNull())
      .execute()
  } else {
    await db.schema.alterTable('repo_seq').renameColumn('seq', 'id').execute()
    await db.schema.alterTable('repo_seq').renameTo('repo_event').execute()
    await db.schema
      .createView('repo_seq')
      .as(
        db
          .selectFrom('repo_event')
          .select([
            'id as seq',
            'did',
            'eventType',
            'event',
            'invalidated',
            'sequencedAt',
          ]),
      )
      .execute()
  }

  let builder = db.schema.createTable('outgoing_repo_seq')
  if (dialect === 'pg') {
    builder = builder.addColumn('seq', 'bigserial', (col) => col.primaryKey())
  } else {
    builder = builder.addColumn('seq', 'integer', (col) =>
      col.autoIncrement().primaryKey(),
    )
  }
  await builder
    .addColumn('eventId', 'bigint', (col) => col.notNull())
    .addForeignKeyConstraint(
      'outgoing_repo_seq_event_id_fkey',
      ['eventId'],
      'repo_seq',
      ['id'],
      (cb) => cb.onDelete('cascade'),
    )
    .execute()
}

export async function down(
  db: Kysely<unknown>,
  dialect: Dialect,
): Promise<void> {
  await db.schema.dropTable('outoing_repo_seq').execute()
  if (dialect === 'sqlite') {
    return
  } else {
    await db.schema.dropView('repo_seq').execute()
    await db.schema.alterTable('repo_event').renameColumn('id', 'seq').execute()
    await db.schema.alterTable('repo_event').renameTo('repo_seq').execute()
  }
}
