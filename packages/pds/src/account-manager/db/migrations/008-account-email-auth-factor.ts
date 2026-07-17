import type { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('account')
    .addColumn('emailAuthFactorAt', 'varchar')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('account')
    .dropColumn('emailAuthFactorAt')
    .execute()
}
