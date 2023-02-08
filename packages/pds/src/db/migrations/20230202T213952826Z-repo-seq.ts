import { Kysely } from 'kysely'
import { Dialect } from '..'
const repoSeqTable = 'repo_seq'

export async function up(db: Kysely<unknown>, dialect: Dialect): Promise<void> {
  let builder = db.schema.createTable(repoSeqTable)
  if (dialect === 'pg') {
    builder = builder.addColumn('seq', 'serial', (col) => col.primaryKey())
  } else {
    builder = builder.addColumn('seq', 'integer', (col) =>
      col.autoIncrement().primaryKey(),
    )
  }
  // @TODO add foreign keys
  builder = builder
    .addColumn('did', 'varchar', (col) => col.notNull())
    .addColumn('commit', 'varchar', (col) => col.notNull())
    .addColumn('eventType', 'varchar', (col) => col.notNull())
    .addColumn('sequencedAt', 'varchar', (col) => col.notNull())
    .addForeignKeyConstraint(
      'repo_seq_commit_history_fkey',
      ['did', 'commit'],
      'repo_commit_history',
      ['creator', 'commit'],
    )

  await builder.execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable(repoSeqTable).execute()
}
