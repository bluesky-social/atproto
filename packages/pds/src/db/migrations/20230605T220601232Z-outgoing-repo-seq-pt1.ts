import { Kysely } from 'kysely'
import { Dialect } from '..'

export async function up(db: Kysely<any>, dialect: Dialect): Promise<void> {
  if (dialect === 'sqlite') {
    // await db.schema.dropTable('repo_seq').execute()
    // await db.schema
    //   .createTable('repo_event')
    //   .addColumn('id', 'integer', (col) => col.autoIncrement().primaryKey())
    //   .addColumn('did', 'varchar', (col) => col.notNull())
    //   .addColumn('eventType', 'varchar', (col) => col.notNull())
    //   .addColumn('event', sql`blob`, (col) => col.notNull())
    //   .addColumn('invalidated', 'int2', (col) => col.notNull().defaultTo(0))
    //   .addColumn('sequencedAt', 'varchar', (col) => col.notNull())
    //   .execute()
  } else {
    await db.schema
      .alterTable('repo_seq')
      .addColumn('outgoingSeq', 'bigint')
      .execute()

    await db.schema
      .createIndex('repo_seq_outgoing_seq_idx')
      .on('repo_seq')
      .column('outgoingSeq')
      .execute()
  }
}

export async function down(
  db: Kysely<unknown>,
  dialect: Dialect,
): Promise<void> {
  if (dialect === 'sqlite') {
    return
  }
  await db.schema.dropIndex('repo_seq_outgoing_seq_idx').execute()
  await db.schema.alterTable('repo_seq').dropColumn('outgoingSeq').execute()
}
