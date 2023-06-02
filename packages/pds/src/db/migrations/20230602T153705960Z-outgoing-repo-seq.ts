import { Kysely } from 'kysely'
import { Dialect } from '..'

export async function up(db: Kysely<unknown>, dialect: Dialect): Promise<void> {
  let builder = db.schema.createTable('outgoing_repo_seq')
  if (dialect === 'pg') {
    builder = builder.addColumn('seq', 'bigserial', (col) => col.primaryKey())
  } else {
    builder = builder.addColumn('seq', 'integer', (col) =>
      col.autoIncrement().primaryKey(),
    )
  }
  await builder.addColumn('eventId', 'bigint', (col) => col.notNull()).execute()

  await db.schema
    .createIndex('outgoing_repo_seq_event_id_idx')
    .on('outgoing_repo_seq')
    .column('eventId')
    .execute()

  await db.schema.alterTable('repo_seq').renameColumn('seq', 'id').execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('outgoing_repo_seq').execute()
  await db.schema.alterTable('repo_seq').renameColumn('id', 'seq').execute()
}
