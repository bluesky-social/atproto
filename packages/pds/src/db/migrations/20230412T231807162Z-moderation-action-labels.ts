import { Kysely } from 'kysely'

const moderationActionTable = 'moderation_action'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable(moderationActionTable)
    .addColumn('createLabelVals', 'varchar')
    .execute()

  await db.schema
    .alterTable(moderationActionTable)
    .addColumn('negateLabelVals', 'varchar')
    .execute()

  await db.schema.dropTable('label').execute()

  await db.schema
    .createTable('label')
    .addColumn('src', 'varchar', (col) => col.notNull())
    .addColumn('uri', 'varchar', (col) => col.notNull())
    .addColumn('cid', 'varchar', (col) => col.notNull())
    .addColumn('val', 'varchar', (col) => col.notNull())
    .addColumn('neg', 'int2', (col) => col.notNull()) // @TODO convert to boolean in appview
    .addColumn('cts', 'varchar', (col) => col.notNull())
    .addPrimaryKeyConstraint('label_pkey', ['src', 'uri', 'cid', 'val'])
    .execute()

  await db.schema
    .createIndex('label_uri_index')
    .on('label')
    .column('uri')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable(moderationActionTable)
    .dropColumn('createLabelVals')
    .execute()

  await db.schema
    .alterTable(moderationActionTable)
    .dropColumn('negateLabelVals')
    .execute()

  await db.schema.dropTable('label').execute()

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
