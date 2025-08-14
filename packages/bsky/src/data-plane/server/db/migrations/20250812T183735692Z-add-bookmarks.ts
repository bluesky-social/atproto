import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('bookmark')
    .addColumn('creator', 'varchar', (col) => col.notNull())
    .addColumn('key', 'varchar', (col) => col.notNull())
    .addColumn('subjectUri', 'varchar', (col) => col.notNull())
    .addColumn('subjectCid', 'varchar', (col) => col.notNull())
    .addColumn('indexedAt', 'varchar', (col) => col.notNull())
    // Supports paginating over creator's bookmarks sorting by key.
    .addPrimaryKeyConstraint('bookmark_pkey', ['creator', 'key'])
    // Supports checking for bookmark presence by the creator on specific uris, and supports counting bookmarks by uri.
    .addUniqueConstraint('bookmark_unique_uri_creator', [
      'subjectUri',
      'creator',
    ])
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('bookmark').execute()
}
