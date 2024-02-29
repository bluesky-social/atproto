import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('blob_divert_event')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('subjectDid', 'varchar', (col) => col.notNull())
    .addColumn('subjectBlobCid', 'varchar', (col) => col.notNull())
    .addColumn('subjectUri', 'varchar')
    .addColumn('divertedAt', 'timestamptz')
    .addColumn('lastAttempted', 'timestamptz')
    .addColumn('attempts', 'integer', (col) => col.notNull().defaultTo(0))
    .addUniqueConstraint('blob_divert_event_unique_evt', [
      'subjectDid',
      'subjectBlobCid',
    ])
    .execute()
  await db.schema
    .createIndex('blob_divert_unique_idx')
    .on('blob_divert_event')
    .columns(['divertedAt', 'attempts'])
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('blob_divert_event').execute()
}
