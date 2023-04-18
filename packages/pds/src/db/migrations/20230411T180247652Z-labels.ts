import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('label')
    .addColumn('sourceDid', 'varchar', (col) => col.notNull())
    .addColumn('subjectUri', 'varchar', (col) => col.notNull())
    .addColumn('subjectCid', 'varchar')
    .addColumn('value', 'varchar', (col) => col.notNull())
    .addColumn('negated', 'int2', (col) => col.notNull()) // @TODO convert to boolean in appview
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .addPrimaryKeyConstraint('label_pkey', [
      'sourceDid',
      'subjectUri',
      'subjectCid',
      'value',
    ])
    .execute()

  await db.schema
    .createIndex('label_subject_uri_index')
    .on('label')
    .column('subjectUri')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('label').execute()
}
