import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('list')
    .addColumn('uri', 'varchar', (col) => col.primaryKey())
    .addColumn('cid', 'varchar', (col) => col.notNull())
    .addColumn('creator', 'varchar', (col) => col.notNull())
    .addColumn('name', 'varchar', (col) => col.notNull())
    .addColumn('purpose', 'varchar', (col) => col.notNull())
    .addColumn('description', 'varchar')
    .addColumn('descriptionFacets', 'varchar')
    .addColumn('avatarCid', 'varchar')
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .addColumn('indexedAt', 'varchar', (col) => col.notNull())
    .addColumn('sortAt', 'varchar', (col) =>
      col
        .generatedAlwaysAs(sql`least("createdAt", "indexedAt")`)
        .stored()
        .notNull(),
    )
    .execute()

  await db.schema
    .createIndex('list_creator_idx')
    .on('list')
    .column('creator')
    .execute()

  await db.schema
    .createTable('list_item')
    .addColumn('uri', 'varchar', (col) => col.primaryKey())
    .addColumn('cid', 'varchar', (col) => col.notNull())
    .addColumn('creator', 'varchar', (col) => col.notNull())
    .addColumn('subjectDid', 'varchar', (col) => col.notNull())
    .addColumn('listUri', 'varchar', (col) => col.notNull())
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .addColumn('indexedAt', 'varchar', (col) => col.notNull())
    .addColumn('sortAt', 'varchar', (col) =>
      col
        .generatedAlwaysAs(sql`least("createdAt", "indexedAt")`)
        .stored()
        .notNull(),
    )
    .addUniqueConstraint('list_item_unique_subject_in_list', [
      'listUri',
      'subjectDid',
    ])
    .execute()

  await db.schema
    .createIndex('list_item_creator_idx')
    .on('list_item')
    .column('creator')
    .execute()

  await db.schema
    .createIndex('list_item_subject_idx')
    .on('list_item')
    .column('subjectDid')
    .execute()

  await db.schema
    .createTable('list_mute')
    .addColumn('listUri', 'varchar', (col) => col.notNull())
    .addColumn('mutedByDid', 'varchar', (col) => col.notNull())
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .addPrimaryKeyConstraint('list_mute_pkey', ['mutedByDid', 'listUri'])
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex('list_creator_idx').execute()
  await db.schema.dropIndex('list_item_subject_idx').execute()
  await db.schema.dropTable('list').execute()
  await db.schema.dropTable('list_item').execute()
  await db.schema.dropTable('list_mute').execute()
}
