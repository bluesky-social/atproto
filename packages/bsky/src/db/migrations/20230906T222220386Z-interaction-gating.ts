import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('gate')
    .addColumn('uri', 'varchar', (col) => col.primaryKey())
    .addColumn('cid', 'varchar', (col) => col.notNull())
    .addColumn('creator', 'varchar', (col) => col.notNull())
    .addColumn('postUri', 'varchar', (col) => col.notNull().unique())
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .addColumn('indexedAt', 'varchar', (col) => col.notNull())
    .execute()
  await db.schema
    .alterTable('post')
    .addColumn('isInvalidReply', 'boolean', (col) =>
      col.notNull().defaultTo(false),
    )
    .execute()
  await db.schema
    .alterTable('post')
    .addColumn('isInvalidInteraction', 'boolean', (col) =>
      col.notNull().defaultTo(false),
    )
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('post').dropColumn('isInvalidReply').execute()
  await db.schema
    .alterTable('post')
    .dropColumn('isInvalidInteraction')
    .execute()
}
