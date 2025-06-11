import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('private_data')
    .addColumn('actorDid', 'varchar', (col) => col.notNull())
    .addColumn('namespace', 'varchar', (col) => col.notNull())
    .addColumn('key', 'varchar', (col) => col.notNull())
    .addColumn('payload', 'text', (col) => col.notNull())
    .addColumn('indexedAt', 'varchar', (col) => col.notNull())
    .addColumn('updatedAt', 'varchar', (col) => col.notNull())
    .addPrimaryKeyConstraint('private_data_pkey', [
      'actorDid',
      'namespace',
      'key',
    ])
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('private_data').execute()
}
