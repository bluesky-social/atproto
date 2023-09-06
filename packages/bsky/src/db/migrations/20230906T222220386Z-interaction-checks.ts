import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('post')
    .addColumn('isInvalidReply', 'boolean', (col) =>
      col.notNull().defaultTo(false),
    )
    .execute()
  await db.schema
    .alterTable('post')
    .addColumn('isInvalidInteraction', 'varchar', (col) =>
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
