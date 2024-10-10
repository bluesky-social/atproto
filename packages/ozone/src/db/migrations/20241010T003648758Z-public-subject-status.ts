import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('public_subject_status')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('reporterDid', 'varchar', (col) => col.notNull())
    .addColumn('did', 'varchar', (col) => col.notNull())
    // Default to '' so that we can apply unique constraints on did and recordPath columns
    .addColumn('recordPath', 'varchar', (col) => col.notNull().defaultTo(''))

    .addColumn('modAction', 'varchar', (col) => col.notNull())
    .addColumn('comment', 'varchar')
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .addColumn('updatedAt', 'varchar', (col) => col.notNull())
    .addUniqueConstraint('public_subject_status_unique_idx', [
      'did',
      'reporterDid',
      'recordPath',
    ])
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('public_subject_status')
}
