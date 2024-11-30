import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('actor_state')
    .addColumn('did', 'varchar', (col) => col.primaryKey())
    .addColumn('lastSeenNotifs', 'varchar', (col) => col.notNull())
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('actor_state').execute()
}
