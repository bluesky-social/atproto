import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  // Notifications
  await db.schema
    .createTable('notification')
    .addColumn('id', 'bigserial', (col) => col.primaryKey())
    .addColumn('did', 'varchar', (col) => col.notNull())
    .addColumn('recordUri', 'varchar', (col) => col.notNull())
    .addColumn('recordCid', 'varchar', (col) => col.notNull())
    .addColumn('author', 'varchar', (col) => col.notNull())
    .addColumn('reason', 'varchar', (col) => col.notNull())
    .addColumn('reasonSubject', 'varchar')
    .addColumn('sortAt', 'varchar', (col) => col.notNull())
    .execute()
  await db.schema
    .createIndex('notification_did_sortat_idx')
    .on('notification')
    .columns(['did', 'sortAt'])
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('notification').execute()
}
