import { type Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('space_writer')
    .renameColumn('rev', 'repoRev')
    .execute()
  await db.schema
    .alterTable('space_writer')
    .addColumn('spaceRev', 'varchar', (col) => col.notNull().defaultTo(''))
    .execute()

  // @NOTE Bootstrap from repoRev for now.
  // When we ship in production, this will be NOT NULL from the start
  await sql`
    update space_writer set spaceRev = repoRev
  `.execute(db)
  await db.schema
    .createIndex('space_writer_space_rev_idx')
    .on('space_writer')
    .columns(['space', 'spaceRev'])
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex('space_writer_space_rev_idx').execute()
  await db.schema
    .alterTable('space_writer')
    .renameColumn('repoRev', 'rev')
    .execute()
  await db.schema.alterTable('space_writer').dropColumn('spaceRev').execute()
}
