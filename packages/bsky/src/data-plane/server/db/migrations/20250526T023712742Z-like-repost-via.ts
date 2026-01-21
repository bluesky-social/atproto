import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('like').addColumn('via', 'varchar').execute()
  await db.schema.alterTable('like').addColumn('viaCid', 'varchar').execute()

  await db.schema.alterTable('repost').addColumn('via', 'varchar').execute()
  await db.schema.alterTable('repost').addColumn('viaCid', 'varchar').execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('like').dropColumn('via').execute()
  await db.schema.alterTable('like').dropColumn('viaCid').execute()

  await db.schema.alterTable('repost').dropColumn('via').execute()
  await db.schema.alterTable('repost').dropColumn('viaCid').execute()
}
