import type { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('revoked_space_credential')
    .addColumn('space', 'varchar', (col) => col.notNull())
    .addColumn('jti', 'varchar', (col) => col.notNull())
    .addColumn('expiresAt', 'varchar', (col) => col.notNull())
    .addPrimaryKeyConstraint('revoked_space_credential_pkey', ['space', 'jti'])
    .execute()

  await db.schema
    .createIndex('revoked_space_credential_expires_at_idx')
    .on('revoked_space_credential')
    .column('expiresAt')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('revoked_space_credential').execute()
}
