import { Kysely } from 'kysely'
import { Dialect } from '..'

export async function up(db: Kysely<unknown>, dialect: Dialect): Promise<void> {
  await db.schema.alterTable('repo_seq').renameColumn('seq', 'id').execute()

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

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('outgoing_repo_seq').execute()
  await db.schema.alterTable('repo_seq').renameColumn('id', 'seq').execute()
}
