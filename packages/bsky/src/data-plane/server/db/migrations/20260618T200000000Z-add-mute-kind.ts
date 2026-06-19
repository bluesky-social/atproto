import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('mute')
    .addColumn('kind', 'varchar', (col) => col.notNull().defaultTo('all'))
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('mute').dropColumn('kind').execute()
}
