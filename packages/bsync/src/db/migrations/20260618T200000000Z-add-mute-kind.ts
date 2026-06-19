import { Kysely } from 'kysely'

const muteKindAll = 1

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('mute_op')
    .addColumn('kind', 'int2', (col) => col.notNull().defaultTo(muteKindAll))
    .execute()

  await db.schema
    .alterTable('mute_item')
    .addColumn('kind', 'int2', (col) => col.notNull().defaultTo(muteKindAll))
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('mute_item').dropColumn('kind').execute()
  await db.schema.alterTable('mute_op').dropColumn('kind').execute()
}
