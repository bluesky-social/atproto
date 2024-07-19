import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('actor_state')
    .addColumn('priorityNotifs', 'boolean', (col) =>
      col.notNull().defaultTo(false),
    )
    .execute()
  await db.schema
    .alterTable('actor_state')
    .addColumn('lastSeenPriorityNotifs', 'varchar')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('actor_state')
    .dropColumn('priorityNotifs')
    .execute()
  await db.schema
    .alterTable('actor_state')
    .dropColumn('lastSeenPriorityNotifs')
    .execute()
}
