import { Kysely } from 'kysely'

export async function up(db: Kysely<Schema>): Promise<void> {
  await db
    .deleteFrom('duplicate_record')
    .where(
      'duplicateOf',
      'in',
      db.selectFrom('assertion').select('assertion.uri'),
    )
    .orWhere(
      'duplicateOf',
      'in',
      db.selectFrom('assertion').select('assertion.confirmUri'),
    )
    .execute()
  await db.schema.dropTable('assertion').execute()
  await db.schema
    .alterTable('follow')
    .dropColumn('subjectDeclarationCid')
    .execute()
  await db.schema
    .alterTable('did_handle')
    .dropColumn('declarationCid')
    .execute()
  await db.schema.alterTable('did_handle').dropColumn('actorType').execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('did_handle')
    .addColumn('actorType', 'varchar')
    .execute()
  await db.schema
    .alterTable('did_handle')
    .addColumn('declarationCid', 'varchar')
    .execute()
  await db.schema
    .alterTable('follow')
    .addColumn('subjectDeclarationCid', 'varchar', (col) =>
      col.notNull().defaultTo(''),
    )
    .execute()
  await db.schema
    .createTable('assertion')
    .addColumn('uri', 'varchar', (col) => col.primaryKey())
    .addColumn('cid', 'varchar', (col) => col.notNull())
    .addColumn('creator', 'varchar', (col) => col.notNull())
    .addColumn('assertion', 'varchar', (col) => col.notNull())
    .addColumn('subjectDid', 'varchar', (col) => col.notNull())
    .addColumn('subjectDeclarationCid', 'varchar', (col) => col.notNull())
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .addColumn('indexedAt', 'varchar', (col) => col.notNull())
    .addColumn('confirmUri', 'varchar')
    .addColumn('confirmCid', 'varchar')
    .addColumn('confirmCreated', 'varchar')
    .addColumn('confirmIndexed', 'varchar')
    .addUniqueConstraint('assertion_unique_subject', [
      'creator',
      'subjectDid',
      'assertion',
    ])
    .execute()
}

type Schema = {
  assertion: Assertion
  duplicate_record: DuplicateRecord
}

type Assertion = {
  uri: string
  confirmUri: string | null
}

type DuplicateRecord = {
  uri: string
  duplicateOf: string
}
