import { Kysely, sql } from 'kysely'
import { Dialect } from '..'

export async function up(db: Kysely<any>, dialect: Dialect): Promise<void> {
  if (dialect === 'sqlite') {
    await db.schema.dropTable('repo_seq').execute()
    await db.schema
      .createTable('repo_seq')
      .addColumn('id', 'integer', (col) => col.autoIncrement().primaryKey())
      .addColumn('seq', 'integer', (col) => col.unique())
      .addColumn('did', 'varchar', (col) => col.notNull())
      .addColumn('eventType', 'varchar', (col) => col.notNull())
      .addColumn('event', sql`blob`, (col) => col.notNull())
      .addColumn('invalidated', 'int2', (col) => col.notNull().defaultTo(0))
      .addColumn('sequencedAt', 'varchar', (col) => col.notNull())
      .execute()
  } else {
    await db.schema.alterTable('repo_seq').renameColumn('seq', 'id').execute()
    await db.schema
      .alterTable('repo_seq')
      .addColumn('seq', 'bigint', (col) => col.unique())
      .execute()
  }
}

export async function down(
  db: Kysely<unknown>,
  dialect: Dialect,
): Promise<void> {
  if (dialect === 'sqlite') {
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
  } else {
    await db.schema.alterTable('repo_seq').dropColumn('seq').execute()
    await db.schema.alterTable('repo_seq').renameColumn('id', 'seq').execute()
  }
}
