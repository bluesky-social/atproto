import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('account')
    .addColumn('emailAuthFactor', 'int2', (col) => col.notNull().defaultTo(0))
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('account')
    .dropColumn('emailAuthFactor')
    .execute()
}
