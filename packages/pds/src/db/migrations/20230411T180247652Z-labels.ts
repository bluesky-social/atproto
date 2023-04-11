import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('label')
    .addColumn('sourceDid', 'varchar', (col) => col.notNull())
    .addColumn('subjectUri', 'varchar', (col) => col.notNull())
    .addColumn('subjectCid', 'varchar', (col) => col.notNull())
    .addColumn('value', 'varchar', (col) => col.notNull())
    .addColumn('negated', 'int2', (col) => col.notNull()) // @TODO convert to boolean in appview
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .addPrimaryKeyConstraint('label_pkey', [
      'subjectUri',
      'subjectCid',
      'value',
    ])
    .execute()

  await db.schema
    .createIndex('label_source_did_index')
    .on('label')
    .column('sourceDid')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('label').execute()
}
