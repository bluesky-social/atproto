import { Kysely, sql } from 'kysely'
import { Dialect } from '..'

const repoSeqTable = 'repo_seq'
const repoOpTable = 'repo_op'
const repoSeqDidIndex = 'repo_seq_did_index'
const repoSeqCommitIndex = 'repo_seq_commit_index'
const repoSeqEventTypeIndex = 'repo_seq_event_type_index'
const repoSeqSequencedAtIndex = 'repo_seq_sequenced_at_index'

export async function up(db: Kysely<unknown>, dialect: Dialect): Promise<void> {
  await db.schema.dropIndex(repoSeqCommitIndex).execute()
  await db.schema.dropIndex(repoSeqDidIndex).execute()
  await db.schema.dropTable(repoSeqTable).execute()
  await db.schema.dropTable(repoOpTable).execute()

  let builder = db.schema.createTable(repoSeqTable)
  if (dialect === 'pg') {
    builder = builder
      .addColumn('seq', 'bigserial', (col) => col.primaryKey())
      .addColumn('invalidatedBy', 'bigint')
  } else {
    builder = builder
      .addColumn('seq', 'integer', (col) => col.autoIncrement().primaryKey())
      .addColumn('invalidatedBy', 'integer')
  }

  const binaryDatatype = dialect === 'sqlite' ? sql`blob` : sql`bytea`
  await builder
    .addColumn('did', 'varchar', (col) => col.notNull())
    .addColumn('eventType', 'varchar', (col) => col.notNull())
    .addColumn('event', binaryDatatype, (col) => col.notNull())
    .addColumn('sequencedAt', 'varchar', (col) => col.notNull())
    .addForeignKeyConstraint(
      'invalidated_by_fkey',
      // @ts-ignore
      ['invalidatedBy'],
      'repo_seq',
      ['seq'],
    )
    .execute()

  // for filtering seqs based on did
  await db.schema
    .createIndex(repoSeqDidIndex)
    .on(repoSeqTable)
    .column('did')
    .execute()

  // for filtering seqs based on event type
  await db.schema
    .createIndex(repoSeqEventTypeIndex)
    .on(repoSeqTable)
    .column('eventType')
    .execute()

  // for entering into the seq stream at a particular time
  await db.schema
    .createIndex(repoSeqSequencedAtIndex)
    .on(repoSeqTable)
    .column('sequencedAt')
    .execute()
}

export async function down(
  db: Kysely<unknown>,
  dialect: Dialect,
): Promise<void> {
  await db.schema.dropIndex(repoSeqSequencedAtIndex).execute()
  await db.schema.dropIndex(repoSeqEventTypeIndex).execute()
  await db.schema.dropIndex(repoSeqDidIndex).execute()
  await db.schema.dropTable(repoSeqTable).execute()

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

  await db.schema
    .createTable(repoOpTable)
    .addColumn('did', 'text', (col) => col.notNull())
    .addColumn('commit', 'text', (col) => col.notNull())
    .addColumn('action', 'text', (col) => col.notNull())
    .addColumn('path', 'text', (col) => col.notNull())
    .addColumn('cid', 'text')
    .addPrimaryKeyConstraint('repo_op_pkey', ['did', 'commit', 'path'])
    .execute()
}
