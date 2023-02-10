import { Kysely } from 'kysely'
import { Dialect } from '..'

const repoSeqTable = 'repo_seq'
const repoSeqDidIndex = 'repo_seq_did_index'
const repoSeqCommitIndex = 'repo_seq_commit_index'

export async function up(db: Kysely<unknown>, dialect: Dialect): Promise<void> {
  let builder = db.schema.createTable(repoSeqTable)
  if (dialect === 'pg') {
    builder = builder.addColumn('seq', 'serial', (col) => col.primaryKey())
  } else {
    builder = builder.addColumn('seq', 'integer', (col) =>
      col.autoIncrement().primaryKey(),
    )
  }
  await builder
    .addColumn('did', 'varchar', (col) => col.notNull())
    .addColumn('commit', 'varchar', (col) => col.notNull())
    .addColumn('eventType', 'varchar', (col) => col.notNull())
    .addColumn('sequencedAt', 'varchar', (col) => col.notNull())
    .execute()

  await db.schema
    .createIndex(repoSeqDidIndex)
    .on(repoSeqTable)
    .column('did')
    .execute()

  await db.schema
    .createIndex(repoSeqCommitIndex)
    .on(repoSeqTable)
    .column('commit')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex(repoSeqCommitIndex).execute()
  await db.schema.dropIndex(repoSeqDidIndex).execute()
  await db.schema.dropTable(repoSeqTable).execute()
}
