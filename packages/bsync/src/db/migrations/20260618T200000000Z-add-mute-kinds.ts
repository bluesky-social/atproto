import type { Kysely } from 'kysely'

// comma-separated MuteKind names; empty means a full mute
const fullMute = ''

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('mute_op')
    .addColumn('kinds', 'varchar', (col) => col.notNull().defaultTo(fullMute))
    .execute()

  await db.schema
    .alterTable('mute_item')
    .addColumn('kinds', 'varchar', (col) => col.notNull().defaultTo(fullMute))
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('mute_item').dropColumn('kinds').execute()
  await db.schema.alterTable('mute_op').dropColumn('kinds').execute()
}
