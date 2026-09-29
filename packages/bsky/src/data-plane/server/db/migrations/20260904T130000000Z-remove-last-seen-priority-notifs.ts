import type { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('actor_state')
    .dropColumn('lastSeenPriorityNotifs')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('actor_state')
    .addColumn('lastSeenPriorityNotifs', 'varchar')
    .execute()
}
