import { Kysely, sql } from 'kysely'
import { Dialect } from '..'

const repoSeqDidIndex = 'repo_seq_did_index'
const repoSeqEventTypeIndex = 'repo_seq_event_type_index'
const repoSeqSequencedAtIndex = 'repo_seq_sequenced_at_index'

export async function up(db: Kysely<unknown>, dialect: Dialect): Promise<void> {
  if (dialect === 'pg') {
    await db.schema
      .alterTable('repo_seq')
      .dropConstraint('invalidated_by_fkey')
      .execute()
    await db.schema.alterTable('repo_seq').dropColumn('invalidatedBy').execute()
    await db.schema
      .alterTable('repo_seq')
      .addColumn('invalidated', 'int2', (col) => col.notNull().defaultTo(0))
      .execute()
  } else {
    await db.schema.dropTable('repo_seq').execute()
    await db.schema
      .createTable('repo_seq')
      .addColumn('seq', 'integer', (col) => col.autoIncrement().primaryKey())
      .addColumn('did', 'varchar', (col) => col.notNull())
      .addColumn('eventType', 'varchar', (col) => col.notNull())
      .addColumn('event', sql`blob`, (col) => col.notNull())
      .addColumn('invalidated', 'int2', (col) => col.notNull().defaultTo(0))
      .addColumn('sequencedAt', 'varchar', (col) => col.notNull())
      .execute()
  }
}

export async function down(
  db: Kysely<unknown>,
  dialect: Dialect,
): Promise<void> {
  if (dialect === 'pg') {
    await db.schema.alterTable('repo_seq').dropColumn('invalidated').execute()
    await db.schema
      .alterTable('repo_seq')
      .addColumn('invalidatedBy', 'bigint')
      .execute()
    await db.schema
      .alterTable('repo_seq')
      .addForeignKeyConstraint(
        'invalidated_by_fkey',
        // @ts-ignore
        ['invalidatedBy'],
        'repo_seq',
        ['seq'],
      )
      .execute()
  } else {
    await db.schema.dropTable('repo_seq').execute()
    await db.schema
      .createTable('repo_seq')
      .addColumn('seq', 'integer', (col) => col.autoIncrement().primaryKey())
      .addColumn('did', 'varchar', (col) => col.notNull())
      .addColumn('eventType', 'varchar', (col) => col.notNull())
      .addColumn('event', sql`blob`, (col) => col.notNull())
      .addColumn('invalidatedBy', 'integer')
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
      .on('repo_seq')
      .column('did')
      .execute()

    // for filtering seqs based on event type
    await db.schema
      .createIndex(repoSeqEventTypeIndex)
      .on('repo_seq')
      .column('eventType')
      .execute()

    // for entering into the seq stream at a particular time
    await db.schema
      .createIndex(repoSeqSequencedAtIndex)
      .on('repo_seq')
      .column('sequencedAt')
      .execute()
  }
}
