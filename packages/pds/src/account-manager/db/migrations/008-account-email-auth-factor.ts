import type { Kysely } from 'kysely'

/**
 * A dedicated table rather than a column on `account`: further authentication
 * factors can then be added without altering `account` again, which sqlite
 * makes tedious. A row exists only while the factor is enabled.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('account_email_auth_factor')
    .addColumn('did', 'varchar', (col) => col.primaryKey())
    .addColumn('emailAuthFactorEnabledAt', 'varchar', (col) => col.notNull())
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('account_email_auth_factor').execute()
}
