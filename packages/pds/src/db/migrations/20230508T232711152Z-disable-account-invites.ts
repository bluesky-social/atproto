import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('user_account')
    .addColumn('invitesDisabled', 'int2', (col) => col.notNull().defaultTo(0))
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('user_account')
    .dropColumn('invitesDisabled')
    .execute()
}
